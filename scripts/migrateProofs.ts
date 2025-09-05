import { supabase } from '../src/lib/supabaseClient'

/**
 * Migration script to move legacy base64 photos to Supabase Storage
 * Run this once to migrate existing verifications with base64 photos
 */

interface LegacyVerification {
  id: string
  user_id?: string
  task: string
  photo?: string  // base64 encoded
  photo_storage_path?: string | null
  photo_url?: string | null
}

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  return bytes.buffer
}

// Helper function to detect image format from base64
function detectImageFormat(base64: string): string {
  if (base64.startsWith('data:image/png')) return 'image/png'
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) return 'image/jpeg'
  if (base64.startsWith('data:image/gif')) return 'image/gif'
  if (base64.startsWith('data:image/webp')) return 'image/webp'
  
  // Default to JPEG if no data URL prefix
  return 'image/jpeg'
}

// Helper function to get file extension from mime type
function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png': return '.png'
    case 'image/jpeg': return '.jpg'
    case 'image/gif': return '.gif'
    case 'image/webp': return '.webp'
    default: return '.jpg'
  }
}

async function migrateProofs(): Promise<void> {
  try {
    console.log('Starting legacy proof migration...')
    
    // Fetch verifications with base64 photos but no storage path
    const { data: legacyVerifications, error: fetchError } = await supabase
      .from('verifications')
      .select('id, user_id, task, photo, photo_storage_path, photo_url')
      .is('photo_storage_path', null)
      .not('photo', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch legacy verifications: ${fetchError.message}`)
    }

    if (!legacyVerifications || legacyVerifications.length === 0) {
      console.log('No legacy verifications found to migrate.')
      return
    }

    console.log(`Found ${legacyVerifications.length} legacy verifications to migrate`)

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const verification of legacyVerifications as LegacyVerification[]) {
      try {
        console.log(`Migrating verification ${verification.id}...`)
        
        if (!verification.photo) {
          console.log(`Skipping ${verification.id} - no photo data`)
          continue
        }

        // Detect image format and convert to ArrayBuffer
        const mimeType = detectImageFormat(verification.photo)
        const fileExtension = getFileExtension(mimeType)
        const arrayBuffer = base64ToArrayBuffer(verification.photo)

        // Generate storage path
        const userId = verification.user_id || 'legacy'
        const timestamp = Date.now()
        const fileName = `legacy_${verification.id}${fileExtension}`
        const storagePath = `${userId}/${fileName}`

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('proofs')
          .upload(storagePath, arrayBuffer, {
            contentType: mimeType,
            upsert: false
          })

        if (uploadError) {
          // Try with different timestamp if conflict
          if (uploadError.message.includes('already exists')) {
            const newTimestamp = timestamp + Math.floor(Math.random() * 1000)
            const newFileName = `legacy_${verification.id}_${newTimestamp}${fileExtension}`
            const newStoragePath = `${userId}/${newFileName}`
            
            const { data: retryUploadData, error: retryUploadError } = await supabase.storage
              .from('proofs')
              .upload(newStoragePath, arrayBuffer, {
                contentType: mimeType,
                upsert: false
              })
            
            if (retryUploadError) {
              throw new Error(`Upload retry failed: ${retryUploadError.message}`)
            }
            
            // Update verification record with new storage path
            const updateData: any = {
              photo_storage_path: newStoragePath
            }

            // Optionally generate a short-lived signed URL for preview
            try {
              const { data: urlData, error: urlError } = await supabase.storage
                .from('proofs')
                .createSignedUrl(newStoragePath, 7776000) // 90 days TTL for migration preview
              
              if (!urlError && urlData.signedUrl) {
                updateData.photo_url = urlData.signedUrl
              }
            } catch (urlGenError) {
              console.log(`Warning: Could not generate preview URL for ${verification.id}`)
            }

            const { error: updateError } = await supabase
              .from('verifications')
              .update(updateData)
              .eq('id', verification.id)

            if (updateError) {
              // Cleanup uploaded file if DB update fails
              await supabase.storage.from('proofs').remove([newStoragePath])
              throw new Error(`Database update failed: ${updateError.message}`)
            }
          } else {
            throw new Error(`Upload failed: ${uploadError.message}`)
          }
        } else {
          // Update verification record with storage path
          const updateData: any = {
            photo_storage_path: storagePath
          }

          // Optionally generate a short-lived signed URL for preview
          try {
            const { data: urlData, error: urlError } = await supabase.storage
              .from('proofs')
              .createSignedUrl(storagePath, 7776000) // 90 days TTL for migration preview
            
            if (!urlError && urlData.signedUrl) {
              updateData.photo_url = urlData.signedUrl
            }
          } catch (urlGenError) {
            console.log(`Warning: Could not generate preview URL for ${verification.id}`)
          }

          const { error: updateError } = await supabase
            .from('verifications')
            .update(updateData)
            .eq('id', verification.id)

          if (updateError) {
            // Cleanup uploaded file if DB update fails
            await supabase.storage.from('proofs').remove([storagePath])
            throw new Error(`Database update failed: ${updateError.message}`)
          }
        }

        successCount++
        console.log(`✅ Successfully migrated ${verification.id}`)

      } catch (error) {
        errorCount++
        const errorMessage = `❌ Failed to migrate ${verification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMessage)
        errors.push(errorMessage)
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total verifications processed: ${legacyVerifications.length}`)
    console.log(`Successfully migrated: ${successCount}`)
    console.log(`Failed migrations: ${errorCount}`)

    if (errors.length > 0) {
      console.log('\n=== Errors ===')
      errors.forEach(error => console.log(error))
    }

    if (successCount > 0) {
      console.log('\n⚠️  IMPORTANT: After verifying the migration is successful,')
      console.log('   consider removing the old "photo" column from the database:')
      console.log('   ALTER TABLE verifications DROP COLUMN photo;')
    }

  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

// Export for programmatic use
export { migrateProofs }

// Run migration if called directly
if (require.main === module) {
  migrateProofs()
    .then(() => {
      console.log('Migration completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}