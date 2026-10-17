// Profil (persona) sekmeleri, yeni profil, profil ayarları ve yayın durumu.
import { useState } from 'react'
import { Plus, Settings2, Star, Pause, Play, RefreshCw, Trash2, ChevronDown, Radio, Check } from 'lucide-react'
import { Dugme, Girdi, Alan, Secim, Rozet } from '../../ui'
import { birlestir, sayi } from '../../bicim'
import { Acilir, SekmeDugmesi } from './parcalar'

function YeniProfil({ kinds, personas, sinir, onOlustur, onYukselt, onKapat }) {
  const [d, setD] = useState({ kind: 'is', name: '', copyFrom: '' })
  const [mesgul, setMesgul] = useState(false)
  const doldu = sinir != null && personas.length >= sinir
  if (doldu) {
    return (
      <div className="flex flex-col gap-3">
        <b className="font-baslik text-[15px]">Profil sınırı doldu</b>
        <p className="text-[13px] text-metin-2">Planınız {sinir} profile izin veriyor. Daha fazlası için planınızı yükseltin.</p>
        <div className="flex gap-2 justify-end">
          <Dugme tur="sessiz" boyut="k" onClick={onKapat}>Kapat</Dugme>
          <Dugme tur="vurgu" boyut="k" onClick={onYukselt}>Planı yükselt</Dugme>
        </div>
      </div>
    )
  }
  const tur = kinds.find((k) => k.key === d.kind)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setMesgul(true)
        const ok = await onOlustur({ p_kind: d.kind, p_name: d.name.trim() || null, p_copy_from: d.copyFrom || null })
        setMesgul(false)
        if (ok) onKapat()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <b className="font-baslik text-[15px]">Yeni profil</b>
        {sinir != null && <span className="text-xs text-metin-2">{personas.length}/{sinir >= 999 ? '∞' : sinir} profil</span>}
      </div>
      <Alan etiket="Profil türü" id="yeni-tur" ipucu={tur?.description}>
        <Secim etiket="Profil türü" value={d.kind} onChange={(v) => setD({ ...d, kind: v })} className="w-full h-10">
          {kinds.filter((k) => k.key !== 'genel').map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Secim>
      </Alan>
      <Alan etiket="Profil adı (isteğe bağlı)" id="yeni-ad">
        <Girdi id="yeni-ad" value={d.name} maxLength={40} placeholder={tur?.label} onChange={(e) => setD({ ...d, name: e.target.value })} className="h-10 text-[14px]" />
      </Alan>
      <Alan etiket="Başlangıç" id="yeni-kopya">
        <Secim etiket="Başlangıç" value={d.copyFrom} onChange={(v) => setD({ ...d, copyFrom: v })} className="w-full h-10">
          <option value="">Şablondan başla (hassas bilgiler kapalı)</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.name} profilinden kopyala</option>)}
        </Secim>
      </Alan>
      <div className="flex gap-2 justify-end">
        <Dugme tur="sessiz" boyut="k" onClick={onKapat}>Vazgeç</Dugme>
        <Dugme type="submit" tur="ana" boyut="k" disabled={mesgul}>Oluştur</Dugme>
      </div>
    </form>
  )
}

// İki adımlı onay: geri alınamaz işlemler aynı yerde bir kez daha sorulur.
function OnayliDugme({ ikon, metin, soru, onayMetni, tehlike, onOnay, disabled }) {
  const [soruyor, setSoruyor] = useState(false)
  if (!soruyor) {
    return <Dugme tur={tehlike ? 'tehlikeSessiz' : 'sessiz'} boyut="k" ikon={ikon} className="justify-start" disabled={disabled} onClick={() => setSoruyor(true)}>{metin}</Dugme>
  }
  return (
    <div className={birlestir('rounded-xl p-3 flex flex-col gap-2 text-[13px]', tehlike ? 'bg-red-50 dark:bg-red-500/10' : 'bg-yuzey-2')}>
      <p>{soru}</p>
      <div className="flex gap-2 justify-end">
        <Dugme tur="sessiz" boyut="k" onClick={() => setSoruyor(false)}>Vazgeç</Dugme>
        <Dugme tur={tehlike ? 'tehlike' : 'ana'} boyut="k" onClick={async () => { await onOnay(); setSoruyor(false) }}>{onayMetni}</Dugme>
      </div>
    </div>
  )
}

function ProfilAyarlari({ persona, editor, islem, cardAdres }) {
  const ana = persona.is_primary
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <b className="font-baslik text-[15px]">Profil ayarları</b>
        <span className="text-xs text-metin-2">{sayi(persona.view_count || 0)} görüntülenme</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <Rozet>{persona.kind_label || persona.kind}</Rozet>
        {ana && <Rozet ton="vurgu" ikon={Star}>Ana profil</Rozet>}
        {persona.status === 'paused' && <Rozet ton="uyari">Duraklatıldı</Rozet>}
      </div>
      <Alan etiket="Profil adı" id="ayar-ad" ipucu="Yalnız sizin gördüğünüz sekme adı.">
        <Girdi
          id="ayar-ad"
          key={`ad-${persona.id}-${persona.name}`}
          defaultValue={persona.name}
          maxLength={40}
          className="h-10 text-[14px]"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== persona.name) islem.personaGuncelle({ name: v }, 'Profil adı kaydedildi') }}
        />
      </Alan>
      <Alan etiket="Kartta görünen ad" id="ayar-gorunen" ipucu="Boş bırakırsanız ad soyadınız görünür.">
        <Girdi
          id="ayar-gorunen"
          key={`g-${persona.id}-${editor?.persona?.display_name || ''}`}
          defaultValue={editor?.persona?.display_name || ''}
          placeholder={editor?.profile_name || ''}
          maxLength={80}
          className="h-10 text-[14px]"
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (editor?.persona?.display_name || '')) islem.personaGuncelle({ display_name: v }, 'Görünen ad kaydedildi') }}
        />
      </Alan>
      <div className="flex flex-col gap-1 border-t border-cizgi pt-3">
        {ana ? (
          <p className="text-xs text-metin-2">Ana profil {cardAdres} adresinde ve basılı NFC/QR kartlarınızda görünür; duraklatılamaz ve silinemez.</p>
        ) : (
          <>
            <OnayliDugme ikon={Star} metin="Ana profil yap" onayMetni="Ana profil yap" soru={`Basılı NFC/QR kartlarınız ve ${cardAdres} adresiniz artık "${persona.name}" profilini gösterecek.`} onOnay={islem.anaYap} />
            {persona.status === 'paused'
              ? <Dugme tur="sessiz" boyut="k" ikon={Play} className="justify-start" onClick={() => islem.personaGuncelle({ status: 'active' }, 'Profil yayında')}>Yayına al</Dugme>
              : <Dugme tur="sessiz" boyut="k" ikon={Pause} className="justify-start" onClick={() => islem.personaGuncelle({ status: 'paused' }, 'Profil duraklatıldı')}>Duraklat</Dugme>}
            <OnayliDugme ikon={RefreshCw} metin="Bağlantıyı yenile" onayMetni="Yenile" soru="Daha önce paylaştığınız bağlantı ve QR kod çalışmayı durduracak." onOnay={islem.koduYenile} />
            <OnayliDugme ikon={Trash2} tehlike metin="Profili sil" onayMetni="Evet, sil" soru={`"${persona.name}" silinecek; bağlantısı ve QR kodu çalışmayı durduracak.`} onOnay={islem.personaSil} />
          </>
        )}
      </div>
    </div>
  )
}

export function ProfilSekmeleri({ personas, aktifId, onSec, kinds, sinir, editor, islem, onYukselt, cardAdres }) {
  const [acik, setAcik] = useState(null) // 'yeni' | 'ayar'
  const kapat = () => setAcik(null)
  const secili = personas.find((p) => p.id === aktifId)
  return (
    <div className="flex items-center gap-2 relative">
      <div role="tablist" aria-label="Profiller" className="inline-flex bg-yuzey-2 rounded-[10px] p-[3px] gap-0.5 max-w-full overflow-x-auto">
        {personas.map((p) => (
          <SekmeDugmesi key={p.id} role="tab" aria-selected={p.id === aktifId} secili={p.id === aktifId} onClick={() => onSec(p.id)}>
            {p.name}{p.is_primary ? ' · Ana' : ''}
            {p.status === 'paused' && <Pause size={12} aria-label="duraklatıldı" />}
          </SekmeDugmesi>
        ))}
        <SekmeDugmesi data-acilir-tetik aria-label="Profil ekle" aria-expanded={acik === 'yeni'} secili={false} onClick={() => setAcik(acik === 'yeni' ? null : 'yeni')}>
          <Plus size={14} aria-hidden="true" />
        </SekmeDugmesi>
      </div>
      {secili && (
        <button
          type="button"
          data-acilir-tetik
          aria-label="Profil ayarları"
          title="Profil ayarları"
          aria-expanded={acik === 'ayar'}
          onClick={() => setAcik(acik === 'ayar' ? null : 'ayar')}
          className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-[10px] border border-cizgi bg-yuzey text-metin-2 hover:text-metin"
        >
          <Settings2 size={16} aria-hidden="true" />
        </button>
      )}
      <Acilir acik={acik === 'yeni'} onKapat={kapat} className="top-full left-0 w-[min(340px,calc(100vw-32px))]">
        <YeniProfil kinds={kinds} personas={personas} sinir={sinir} onOlustur={islem.personaOlustur} onYukselt={() => { kapat(); onYukselt() }} onKapat={kapat} />
      </Acilir>
      <Acilir acik={acik === 'ayar' && !!secili} onKapat={kapat} className="top-full left-0 w-[min(340px,calc(100vw-32px))]">
        {secili && <ProfilAyarlari persona={secili} editor={editor} islem={{ ...islem, personaSil: async () => { await islem.personaSil(); kapat() } }} cardAdres={cardAdres} />}
      </Acilir>
    </div>
  )
}

// "Yayınla" yerine: değişiklikler anında kaydedildiği için bu düğme profilin
// yayın durumunu (active/paused) yönetir. Ana profil duraklatılamaz.
export function YayinDurumu({ persona, onDegistir }) {
  const [acik, setAcik] = useState(false)
  if (!persona) return null
  const yayinda = persona.status !== 'paused'
  return (
    <div className="relative">
      <Dugme
        tur={yayinda ? 'ana' : 'vurgu'}
        ikon={yayinda ? Radio : Pause}
        sagIkon={ChevronDown}
        data-acilir-tetik
        aria-haspopup="menu"
        aria-expanded={acik}
        onClick={() => setAcik((v) => !v)}
      >
        {yayinda ? 'Yayında' : 'Duraklatıldı'}
      </Dugme>
      <Acilir acik={acik} onKapat={() => setAcik(false)} className="right-0 top-full w-64 p-1.5">
        <div role="menu" className="flex flex-col">
          <button role="menuitemradio" aria-checked={yayinda} type="button" onClick={() => { setAcik(false); if (!yayinda) onDegistir('active') }} className="flex items-start gap-2.5 text-left rounded-lg px-3 py-2 hover:bg-yuzey-2">
            <Check size={16} className={birlestir('mt-0.5 shrink-0', yayinda ? 'text-aksan' : 'invisible')} aria-hidden="true" />
            <span><b className="text-[13px] block">Yayında</b><span className="text-xs leading-snug text-metin-2 block">Bağlantıyı açan herkes kartı görür.</span></span>
          </button>
          <button
            role="menuitemradio"
            aria-checked={!yayinda}
            type="button"
            disabled={persona.is_primary}
            onClick={() => { setAcik(false); if (yayinda) onDegistir('paused') }}
            className="flex items-start gap-2.5 text-left rounded-lg px-3 py-2 hover:bg-yuzey-2 disabled:opacity-55 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <Check size={16} className={birlestir('mt-0.5 shrink-0', !yayinda ? 'text-aksan' : 'invisible')} aria-hidden="true" />
            <span>
              <b className="text-[13px] block">Duraklat</b>
              <span className="text-xs leading-snug text-metin-2 block">{persona.is_primary ? 'Ana profil duraklatılamaz; basılı kartlarınız onu gösterir.' : 'Bağlantı geçici olarak kapanır, silinmez.'}</span>
            </span>
          </button>
        </div>
      </Acilir>
    </div>
  )
}
