// Canlı önizleme: adres (kullanıcı adı burada düzenlenir), kitle seçimi ve
// telefon çerçevesinde kartın o kitleye görünen hâli.
import { useEffect, useState } from 'react'
import { Copy, Check, Lock, Loader2, X, CalendarDays, Landmark, FileText, ShoppingBag, Star, Receipt, BadgeCheck } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { SITE_URL } from '../../../lib/siteUrl'
import { Kart, Rozet } from '../../ui'
import { basHarf, birlestir, tl } from '../../bicim'
import { SekmeDugmesi } from './parcalar'
import { KITLELER, alanDegeri, doluMu, platformAdi } from './yardim'

const ALAN_ADRESI = SITE_URL.replace(/^https?:\/\/(www\.)?/, '')

function kullaniciAdiHatasi(v) {
  if (!v) return 'Kullanıcı adı boş olamaz'
  if (v.length < 3) return 'En az 3 karakter olmalı'
  if (v.length > 30) return 'En fazla 30 karakter olabilir'
  if (!/^[a-z0-9_-]+$/.test(v)) return 'Yalnız küçük harf, rakam, - ve _'
  if (/^[-_]/.test(v)) return '- veya _ ile başlayamaz'
  return null
}

// Adres çubuğu. Ana profil /card/<kullanıcı-adı> adresindedir ve kullanıcı adı
// burada düzenlenir; diğer profiller tahmin edilemeyen /k/<kod> ile paylaşılır.
function AdresCubugu({ profile, persona, setProfile, bildir, onKaydedildi }) {
  const ana = !!persona?.is_primary
  const mevcut = profile?.username || ''
  const [taslak, setTaslak] = useState(mevcut)
  const [durum, setDurum] = useState({ tur: 'ayni' })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const degisti = ana && taslak !== mevcut

  // Müsaitlik denetimi yazmayı bırakınca (500 ms) yapılır.
  useEffect(() => {
    if (!degisti || kullaniciAdiHatasi(taslak)) return undefined
    let iptal = false
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_username_available', { p_username: taslak })
      if (iptal) return
      if (error) setDurum({ tur: 'hata', mesaj: 'Kontrol edilemedi, tekrar deneyin' })
      else setDurum(data ? { tur: 'musait', mesaj: 'Kullanılabilir' } : { tur: 'hata', mesaj: 'Bu kullanıcı adı alınmış' })
    }, 500)
    return () => { iptal = true; clearTimeout(t) }
  }, [taslak, degisti])

  const degistir = (e) => {
    const v = e.target.value.toLowerCase().trim()
    setTaslak(v)
    if (v === mevcut) { setDurum({ tur: 'ayni' }); return }
    const h = kullaniciAdiHatasi(v)
    setDurum(h ? { tur: 'hata', mesaj: h } : { tur: 'kontrol' })
  }

  const kaydet = async () => {
    if (durum.tur !== 'musait') return
    setKaydediliyor(true)
    try {
      // .select() olmadan erişim kuralı engellediğinde hata dönmez, 0 satır güncellenir.
      const { data, error } = await supabase.from('profiles').update({ username: taslak }).eq('id', profile.id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('bu işlem için yetkiniz yok')
      setProfile((p) => ({ ...p, username: taslak }))
      setDurum({ tur: 'ayni' })
      onKaydedildi?.()
      bildir('Kullanıcı adı güncellendi. Basılı QR ve NFC kartlarınız çalışmaya devam eder.', 'success')
    } catch (err) {
      bildir('Kullanıcı adı kaydedilemedi: ' + err.message, 'error')
    } finally {
      setKaydediliyor(false)
    }
  }

  const tamAdres = ana ? `${SITE_URL}/card/${mevcut}` : `${SITE_URL}/k/${persona?.share_code || ''}`
  const kopyala = async () => {
    try { await navigator.clipboard.writeText(tamAdres); bildir('Bağlantı kopyalandı', 'success') } catch { bildir('Kopyalanamadı — bağlantıyı elle seçin', 'warning') }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={birlestir('flex items-center border rounded-[10px] overflow-hidden h-10 bg-yuzey', durum.tur === 'hata' ? 'border-red-300 dark:border-red-500/50' : 'border-cizgi')}>
        <span className="px-2.5 h-full flex items-center bg-yuzey-2 text-metin-2 text-xs border-r border-cizgi whitespace-nowrap">
          {ALAN_ADRESI}/{ana ? 'card' : 'k'}/
        </span>
        {ana ? (
          <input
            aria-label="Kullanıcı adı"
            value={taslak}
            onChange={degistir}
            onKeyDown={(e) => { if (e.key === 'Enter') kaydet(); if (e.key === 'Escape') { setTaslak(mevcut); setDurum({ tur: 'ayni' }) } }}
            maxLength={30}
            spellCheck={false}
            className="flex-1 min-w-0 h-full px-2.5 bg-transparent font-mono text-[13px] text-metin focus:outline-none"
          />
        ) : (
          <input aria-label="Profil bağlantı kodu" readOnly value={persona?.share_code || ''} className="flex-1 min-w-0 h-full px-2.5 bg-transparent font-mono text-[13px] text-metin focus:outline-none" />
        )}
        {degisti && (
          <button
            type="button"
            onClick={kaydet}
            disabled={durum.tur !== 'musait' || kaydediliyor}
            aria-label="Kullanıcı adını kaydet"
            title="Kaydet"
            className="h-full px-2.5 border-l border-cizgi text-aksan disabled:text-metin-2 disabled:opacity-60 inline-flex items-center"
          >
            {durum.tur === 'kontrol' || kaydediliyor ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : durum.tur === 'hata' ? <X size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          </button>
        )}
        <button type="button" onClick={kopyala} aria-label="Bağlantıyı kopyala" title="Kopyala" className="w-10 h-full border-l border-cizgi bg-yuzey text-metin-2 hover:text-metin inline-flex items-center justify-center shrink-0">
          <Copy size={16} aria-hidden="true" />
        </button>
      </div>
      {degisti && durum.mesaj && (
        <span role="status" className={birlestir('text-xs', durum.tur === 'hata' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300')}>
          {durum.mesaj}{durum.tur === 'musait' ? ' · kaydetmek için ✓ ya da Enter' : ''}
        </span>
      )}
      {!ana && <span className="text-xs text-metin-2">Bu profil tahmin edilemeyen kodla paylaşılır; kullanıcı adı yalnız ana profilin adresidir.</span>}
    </div>
  )
}

export function CanliOnizlemeKarti({ profile, setProfile, persona, kitle, setKitle, bildir, onKaydedildi }) {
  const yayinda = persona?.status !== 'paused'
  return (
    <Kart className="p-5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[13px]">Canlı önizleme</b>
        <Rozet ton={yayinda ? 'aksan' : 'uyari'}>{yayinda ? 'Yayında' : 'Duraklatıldı'}</Rozet>
      </div>
      <AdresCubugu key={`${persona?.id}-${profile?.username}`} profile={profile} persona={persona} setProfile={setProfile} bildir={bildir} onKaydedildi={onKaydedildi} />
      <div role="group" aria-label="Önizleme kimliği" className="flex bg-yuzey-2 rounded-[9px] p-[3px] gap-0.5 self-start max-w-full overflow-x-auto">
        {KITLELER.map((k) => (
          <SekmeDugmesi key={k.deger} className="h-[30px]" secili={kitle === k.deger} aria-pressed={kitle === k.deger} onClick={() => setKitle(k.deger)}>
            {k.ad}
          </SekmeDugmesi>
        ))}
      </div>
    </Kart>
  )
}

// ------------------------------------------------------------------ telefon
function Satir({ ikon: Ikon, ton = 'aksan', vurgulu, children }) {
  return (
    <div className={birlestir('bg-yuzey border border-cizgi rounded-[10px] px-2.5 py-[9px] text-[11px] font-semibold flex items-center gap-2', vurgulu && 'outline outline-2 outline-aksan outline-offset-1')}>
      <span className={birlestir('w-5 h-5 rounded-md inline-flex items-center justify-center shrink-0', ton === 'vurgu' ? 'bg-vurgu-acik text-vurgu' : ton === 'notr' ? 'bg-yuzey-2 text-metin-2' : 'bg-aksan-acik text-aksan-koyu dark:text-aksan')}>
        {Ikon && <Ikon size={11} aria-hidden="true" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

export function TelefonOnizleme({ editor, profile, persona, kitle, renk, randevu, orgCount, vurgulanan, sosyalGorunum }) {
  const gorur = KITLELER.find((k) => k.deger === kitle)?.gorur || ['public']
  const alan = (k) => editor?.fields?.find((f) => f.key === k)
  const gorunur = (k) => {
    const f = alan(k)
    return f && doluMu(alanDegeri(f)) && gorur.includes(f.visibility || 'private')
  }
  const deger = (k) => alanDegeri(alan(k))
  const x = editor?.persona || {}
  const ad = x.display_name || profile?.name || ''
  const avatar = x.avatar_url || profile?.avatar_url
  const alt = [gorunur('title') && deger('title'), gorunur('company') && deger('company')].filter(Boolean).join(' · ')
  const dogrulanan = (editor?.fields || []).find((f) => f.verified && gorunur(f.key))

  const iletisim = ['email', 'phone', 'whatsapp', 'website', 'city']
    .map((k) => alan(k))
    .filter((f) => f && doluMu(alanDegeri(f)) && (f.visibility || 'private') !== 'private')
  const linkler = (editor?.social_links || []).filter((l) => l.visible)
  const bankalar = x.show_payment && profile?.show_bank_accounts ? profile?.bank_accounts || [] : []
  const fatura = x.show_payment && profile?.show_billing_info ? profile?.billing_info : null
  const belgeler = gorunur('catalog_links') ? deger('catalog_links') || [] : []
  const hizmetler = gorunur('services') ? deger('services') || [] : []
  const bio = gorunur('bio') ? deger('bio') : null

  return (
    <div className="bg-lacivert-950 rounded-[36px] p-2.5 shadow-lg dark:ring-1 dark:ring-cizgi" aria-label="Kart önizlemesi" role="img">
      <div className="bg-zemin rounded-[28px] overflow-hidden flex flex-col max-h-[640px] overflow-y-auto">
        <div className="relative px-4 pt-[26px] pb-4 flex flex-col items-center gap-2 text-white text-center" style={{ background: renk }}>
          {profile?.background_image_url && (
            <>
              <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${profile.background_image_url})` }} aria-hidden="true" />
              <span className="absolute inset-0 bg-black/35" aria-hidden="true" />
            </>
          )}
          {avatar ? (
            <img src={avatar} alt="" className="relative w-[60px] h-[60px] rounded-full object-cover border-[3px] border-white/55" />
          ) : (
            <span className="relative w-[60px] h-[60px] rounded-full bg-white/90 inline-flex items-center justify-center font-baslik font-extrabold text-xl border-[3px] border-white/55" style={{ color: renk }}>
              {basHarf(ad)}
            </span>
          )}
          <div className="relative">
            <div className="font-baslik font-bold text-base leading-tight">{ad || 'Adınız'}</div>
            {alt && <div className="text-[11px] text-white/80 mt-0.5">{alt}</div>}
          </div>
          {dogrulanan && (
            <span className="relative inline-flex items-center gap-1 bg-white/15 rounded-full px-[9px] py-[3px] text-[10px] font-semibold">
              <Check size={10} strokeWidth={3} aria-hidden="true" />{dogrulanan.label} doğrulandı
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col gap-[7px]">
          <div className="grid grid-cols-2 gap-1.5">
            <span className="bg-murekkep text-yuzey rounded-[9px] h-[34px] flex items-center justify-center text-[11px] font-semibold">Rehbere kaydet</span>
            <span className="bg-yuzey border border-cizgi rounded-[9px] h-[34px] flex items-center justify-center text-[11px] font-semibold text-metin-2">Cüzdana ekle</span>
          </div>

          {iletisim.length > 0 && (
            <div className={birlestir('bg-yuzey border border-cizgi rounded-[10px] p-2.5 flex flex-col gap-1.5 text-[11px]', vurgulanan === 'iletisim' && 'outline outline-2 outline-aksan outline-offset-1')}>
              {iletisim.map((f) => (
                <div key={f.key} className="flex justify-between gap-2 min-w-0">
                  <span className="text-metin-2 shrink-0">{f.label}</span>
                  {gorur.includes(f.visibility) ? (
                    <b className="truncate">{String(alanDegeri(f))}</b>
                  ) : (
                    <span className="flex items-center gap-1 text-metin-2 whitespace-nowrap">
                      <Lock size={10} aria-hidden="true" />{f.visibility === 'link_only' ? 'bağlantısı olana' : 'onaylı kişiye'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {bio && <p className={birlestir('text-[11px] text-metin-2 px-1 line-clamp-3', vurgulanan === 'hakkinda' && 'outline outline-2 outline-aksan outline-offset-2 rounded')}>{bio}</p>}

          {randevu?.aktif && <Satir ikon={CalendarDays} vurgulu={vurgulanan === 'randevu'}>Randevu al · {randevu.slot_dakika || 30} dk</Satir>}
          {bankalar.length > 0 && <Satir ikon={Landmark} ton="vurgu" vurgulu={vurgulanan === 'odeme'}>IBAN · kopyala{bankalar.length > 1 ? ` (${bankalar.length})` : ''}</Satir>}
          {fatura && <Satir ikon={Receipt} ton="vurgu" vurgulu={vurgulanan === 'fatura'}>Fatura bilgisi · kopyala</Satir>}

          {/* Sosyal görünüm seçimi önizlemede de görünür: kişi kaydetmeden
              önce hangi hâli seçtiğini görsün (personas.social_layout). */}
          {linkler.length > 0 && (
            <div className={birlestir(
              'rounded-[10px]',
              sosyalGorunum === 'ikon' ? 'flex flex-wrap gap-1.5'
                : sosyalGorunum === 'genis' ? 'flex flex-col gap-1.5'
                : 'grid grid-cols-2 gap-1.5',
              vurgulanan === 'sosyal' && 'outline outline-2 outline-aksan outline-offset-1',
            )}>
              {linkler.map((l, i) => (
                sosyalGorunum === 'ikon' ? (
                  <i key={l.id} title={platformAdi(l.platform)}
                     className={birlestir('w-[30px] h-[30px] rounded-[9px] shrink-0 inline-block', i % 2 ? 'bg-vurgu' : 'bg-murekkep')} />
                ) : (
                  <span key={l.id} className="h-[30px] rounded-[9px] bg-yuzey border border-cizgi flex items-center px-2 gap-1.5 text-[10px] font-semibold min-w-0">
                    <i className={birlestir('w-3.5 h-3.5 rounded shrink-0 inline-block', i % 2 ? 'bg-vurgu' : 'bg-murekkep')} aria-hidden="true" />
                    <span className="truncate">{platformAdi(l.platform)}</span>
                  </span>
                )
              ))}
            </div>
          )}

          {belgeler.map((b, i) => <Satir key={`b${i}`} ikon={FileText} ton="notr" vurgulu={vurgulanan === 'belge'}>{b.title || 'Belge'}</Satir>)}
          {hizmetler.map((h, i) => (
            <Satir key={`h${i}`} ikon={ShoppingBag} vurgulu={vurgulanan === 'hizmet'}>
              {h.title || 'Hizmet'}{Number(h.price) > 0 ? ` · ${tl(h.price)}` : ''}
            </Satir>
          ))}
          {gorunur('google_review_link') && <Satir ikon={Star} ton="vurgu" vurgulu={vurgulanan === 'google'}>Google'da yorum yap</Satir>}
          {x.show_organizations && orgCount > 0 && <Satir ikon={BadgeCheck} vurgulu={vurgulanan === 'kurum'}>{orgCount} kurum rozeti</Satir>}

          {persona?.status === 'paused' && (
            <p className="text-[11px] text-center text-metin-2 py-2">Bu profil duraklatıldı: bağlantıyı açan kişi kartı göremez.</p>
          )}
        </div>
      </div>
    </div>
  )
}
