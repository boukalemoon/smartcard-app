// Kartım düzenleyicisinin küçük, tekrar kullanılan parçaları.
import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { birlestir } from '../../bicim'
import { SEVIYELER, SEVIYE_AD, TEMA_RENKLERI } from './yardim'

export function Yakinda({ className }) {
  return (
    <span className={birlestir('inline-flex items-center h-5 px-[7px] rounded-full bg-yuzey-2 text-metin-2 text-[10px] font-semibold whitespace-nowrap align-middle', className)}>
      Yakında
    </span>
  )
}

// Görünürlük seçici. Sunucunun henüz uygulamadığı seviyeler listede görünür
// ama seçilemez; "Karışık" yalnız gösterim içindir.
export function GorunurlukSecici({ deger, onChange, etiket, disabled, ikiSeviye, className }) {
  const vurgulu = deger === 'link_only' || deger === 'on_request'
  return (
    <select
      aria-label={etiket}
      value={deger}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={birlestir(
        'h-9 rounded-[9px] border bg-yuzey text-metin text-[13px] font-medium pl-2.5 pr-7 min-w-0',
        'focus:outline-none focus:ring-2 focus:ring-aksan/40 disabled:opacity-60 disabled:cursor-not-allowed',
        vurgulu ? 'border-vurgu' : 'border-cizgi',
        className,
      )}
    >
      {deger === 'karisik' && <option value="karisik" disabled>Karışık</option>}
      {SEVIYELER.map((s) => {
        const kapali = s.yakinda || (ikiSeviye && s.deger !== 'public' && s.deger !== 'private')
        // Seçili değer desteklenmeyen bir seviyeyse (eski veri) yine de görünsün.
        if (kapali && ikiSeviye && deger !== s.deger) return null
        return (
          <option key={s.deger} value={s.deger} disabled={kapali && deger !== s.deger}>
            {s.ad}{s.yakinda ? ' · yakında' : ''}
          </option>
        )
      })}
    </select>
  )
}

export function SeviyeRozeti({ deger }) {
  const ton = {
    public: 'bg-aksan-acik text-aksan-koyu dark:text-aksan',
    link_only: 'bg-vurgu-acik text-vurgu',
    on_request: 'bg-yuzey-2 text-metin',
    private: 'bg-yuzey-2 text-metin-2',
    karisik: 'bg-yuzey-2 text-metin',
  }[deger] || 'bg-yuzey-2 text-metin-2'
  return <span className={birlestir('inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap', ton)}>{SEVIYE_AD[deger] || deger}</span>
}

// Tasarımdaki koyu seçili sekme grubu (profil sekmeleri, önizleme kitlesi)
export function SekmeDugmesi({ secili, children, className, ...p }) {
  return (
    <button
      type="button"
      className={birlestir(
        'inline-flex items-center gap-1.5 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-aksan',
        secili ? 'bg-murekkep text-yuzey' : 'text-metin-2 hover:text-metin',
        className || 'h-9',
      )}
      {...p}
    >
      {children}
    </button>
  )
}

// Dışarı tıklayınca ya da Esc ile kapanan açılır panel
export function Acilir({ acik, onKapat, children, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!acik) return undefined
    // Açan düğmenin kendisi (data-acilir-tetik) hariç: yoksa kapatıp hemen yeniden açar.
    const tikla = (e) => {
      if (e.target.closest?.('[data-acilir-tetik]')) return
      if (ref.current && !ref.current.contains(e.target)) onKapat()
    }
    const tus = (e) => { if (e.key === 'Escape') onKapat() }
    document.addEventListener('mousedown', tikla)
    document.addEventListener('keydown', tus)
    return () => { document.removeEventListener('mousedown', tikla); document.removeEventListener('keydown', tus) }
  }, [acik, onKapat])
  if (!acik) return null
  return (
    <div ref={ref} className={birlestir('absolute z-40 mt-2 rounded-2xl border border-cizgi bg-yuzey text-metin shadow-lg p-4', className)}>
      {children}
    </div>
  )
}

// Görsel yükleme (ImageUpload.jsx'in mantığı, panel tasarımıyla).
// Kova kuralı (yalnız JPG/PNG/WebP/GIF, 5 MB) sunucuda da uygulanıyor.
const IZINLI = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export function GorselYukle({ kova, mevcut, onYuklendi, onKaldir, etiket, maksMb = 2, bildir, kare }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const id = `gorsel-${kova}`
  const sec = async (e) => {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    if (dosya.size > maksMb * 1024 * 1024) { bildir(`Dosya ${maksMb} MB'tan küçük olmalı.`, 'error'); return }
    if (!IZINLI.includes(dosya.type)) { bildir('Yalnızca JPG, PNG, WebP veya GIF yüklenebilir.', 'error'); return }
    setYukleniyor(true)
    try {
      const uzanti = dosya.name.split('.').pop()
      const ad = `${Math.random().toString(36).slice(2)}_${Date.now()}.${uzanti}`
      // Önce yükle, sonra eskisini sil: yükleme düşerse kullanıcı görselsiz kalmasın.
      const { error } = await supabase.storage.from(kova).upload(ad, dosya, { cacheControl: '3600', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from(kova).getPublicUrl(ad)
      await onYuklendi(data.publicUrl)
      if (mevcut) {
        const { error: silHata } = await supabase.storage.from(kova).remove([mevcut.split('/').pop()])
        if (silHata) console.warn('Eski görsel silinemedi:', silHata.message)
      }
    } catch (err) {
      bildir('Yükleme hatası: ' + (err?.message || 'bilinmeyen'), 'error')
    } finally {
      setYukleniyor(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <span className={birlestir('shrink-0 overflow-hidden border border-cizgi bg-yuzey-2 inline-flex items-center justify-center text-metin-2', kare ? 'w-14 h-14 rounded-full' : 'w-24 h-14 rounded-xl')}>
        {mevcut ? <img src={mevcut} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={18} aria-hidden="true" />}
      </span>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[13px] font-semibold">{etiket}</span>
        <div className="flex items-center gap-2 flex-wrap">
          <input id={id} type="file" accept={IZINLI.join(',')} onChange={sec} disabled={yukleniyor} className="sr-only" />
          <label htmlFor={id} className={birlestir('inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-cizgi bg-yuzey text-[13px] font-semibold cursor-pointer hover:bg-yuzey-2', yukleniyor && 'opacity-60 pointer-events-none')}>
            {yukleniyor ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
            {mevcut ? 'Değiştir' : 'Yükle'}
          </label>
          {mevcut && onKaldir && (
            <button type="button" onClick={onKaldir} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
              <Trash2 size={14} aria-hidden="true" />Kaldır
            </button>
          )}
          <span className="text-xs text-metin-2">En fazla {maksMb} MB · JPG, PNG, WebP</span>
        </div>
      </div>
    </div>
  )
}

// Tema rengi: hazır renkler + serbest renk
export function RenkSecici({ deger, onSec, disabled }) {
  const kucuk = String(deger || '').toLowerCase()
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Tema rengi">
      {TEMA_RENKLERI.map((r) => {
        const sec = kucuk === r.toLowerCase()
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            aria-label={`Tema rengi ${r}`}
            aria-pressed={sec}
            onClick={() => onSec(r)}
            style={{ background: r }}
            className={birlestir('w-8 h-8 rounded-full inline-flex items-center justify-center text-white ring-offset-2 ring-offset-yuzey disabled:opacity-50', sec ? 'ring-2 ring-aksan' : 'ring-1 ring-cizgi')}
          >
            {sec && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        )
      })}
      <label className="inline-flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-full border border-cizgi text-[12px] font-semibold text-metin-2 cursor-pointer">
        {/* Sürüklerken her adımda kaydetmesin: seçim bitince (blur) yazılır. */}
        <input
          key={deger || 'yok'}
          type="color"
          defaultValue={/^#[0-9a-f]{6}$/i.test(deger || '') ? deger : '#0A52B0'}
          disabled={disabled}
          onBlur={(e) => { if (e.target.value.toLowerCase() !== kucuk) onSec(e.target.value) }}
          className="w-6 h-6 rounded-full border-0 bg-transparent p-0 cursor-pointer"
          aria-label="Özel tema rengi"
        />
        Özel
      </label>
    </div>
  )
}
