import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader } from 'lucide-react'

export default function ImageUpload({ 
  currentImageUrl, 
  onUploadSuccess, 
  bucket = 'avatars',
  label = 'Resim Yükle',
  maxSize = 2 // MB
}) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl)

  const uploadImage = async (event) => {
    try {
      setUploading(true)

      const file = event.target.files?.[0]
      if (!file) return

      // Dosya boyutu kontrolü
      if (file.size > maxSize * 1024 * 1024) {
        alert(`Dosya boyutu ${maxSize}MB'dan küçük olmalı!`)
        return
      }

      // Dosya tipi kontrolü
      if (!file.type.startsWith('image/')) {
        alert('Sadece resim dosyaları yüklenebilir!')
        return
      }

      // Unique filename oluştur
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = fileName

      // Eski resmi sil (varsa)
      if (currentImageUrl) {
        const oldFileName = currentImageUrl.split('/').pop()
        await supabase.storage
          .from(bucket)
          .remove([oldFileName])
      }

      // Yeni resmi yükle
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Public URL al
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      setPreviewUrl(publicUrl)
      onUploadSuccess(publicUrl)

    } catch (error) {
      console.error('Upload error:', error)
      alert('Yükleme hatası: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async () => {
    try {
      if (!currentImageUrl) return

      const fileName = currentImageUrl.split('/').pop()
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([fileName])

      if (error) throw error

      setPreviewUrl(null)
      onUploadSuccess(null)
    } catch (error) {
      console.error('Remove error:', error)
      alert('Silme hatası: ' + error.message)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>

      {previewUrl ? (
        <div className="relative inline-block">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={uploadImage}
            disabled={uploading}
            className="hidden"
            id={`image-upload-${bucket}`}
          />
          <label
            htmlFor={`image-upload-${bucket}`}
            className={`flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
              uploading 
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {uploading ? (
              <Loader className="w-8 h-8 text-gray-400 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                  Resim Seç
                </span>
              </>
            )}
          </label>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Maksimum {maxSize}MB, JPG/PNG
      </p>
    </div>
  )
}