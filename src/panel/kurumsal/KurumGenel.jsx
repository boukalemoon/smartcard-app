// KURUM — Genel bakış (tasarım: KurumGenel)
import { useCallback, useMemo, useState } from 'react'
import { ExternalLink, Copy, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabaseClient'
import { Kart, Dugme, Rozet, Istatistik, Avatar, Ilerleme, Yukleniyor } from '../ui'
import { sayi, yuzde, goreli } from '../bicim'
import {
  useVeri, rpc, kurumAdresi, kisaAdres, turAdi, dizinAcikMi, gunOnce, PLAN_AD, basvuruSonuclandir,
} from './veri'
import { KartBas, KurumLogo, DavetPenceresi } from './ortak'

const ayBasi = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d }

export default function KurumGenel({ kurum, bildir, bolumSec, yenileKurumlar, bireyseleGec }) {
  const yonetici = !!kurum.is_admin
  const [davetAcik, setDavetAcik] = useState(false)
  const [islenen, setIslenen] = useState(null)

  // Tüm veriler tek seferde; yönetici değilse yalnızca üye listesi (iletişim gizli gelir).
  const yukle = useCallback(async () => {
    const bas = gunOnce(29)
    const [uyeler, analiz, basvurular, plan, satir] = await Promise.all([
      rpc('org_member_list', { p_org_id: kurum.id }),
      yonetici ? rpc('org_member_analytics', { p_org_id: kurum.id, p_from: bas.toISOString(), p_to: new Date().toISOString() }) : [],
      yonetici && kurum.is_stk
        ? supabase.from('applications').select('id, applicant_name, applicant_email, applicant_phone, status, applied_at, reviewed_at')
          .eq('organization_id', kurum.id).order('applied_at', { ascending: false }).limit(100)
          .then(({ data, error }) => { if (error) throw error; return data || [] })
        : [],
      yonetici ? rpc('my_plan_limits').catch(() => null) : null,
      // Şehir yalnızca kurum kaydında var (my_organizations döndürmüyor).
      supabase.from('organizations').select('city').eq('id', kurum.id).maybeSingle().then(({ data }) => data, () => null),
    ])
    return { uyeler: uyeler || [], analiz: analiz || [], basvurular, plan, sehir: satir?.city || null }
  }, [kurum.id, kurum.is_stk, yonetici])
  const { veri, yukleniyor, yenile } = useVeri(yukle)

  const ozet = useMemo(() => {
    if (!veri) return null
    const kabul = veri.uyeler.filter((u) => u.status !== 'invited')
    const buAy = kabul.filter((u) => u.accepted_at && new Date(u.accepted_at) >= ayBasi()).length
    const yoneticiler = kabul.filter((u) => u.role === 'admin')
    const aktif = kabul.filter((u) => u.status === 'active').length
    const gor = veri.analiz.reduce((t, u) => t + Number(u.profile_views || 0), 0)
    const rehber = veri.analiz.reduce((t, u) => t + Number(u.vcard_downloads || 0), 0)
    const bekleyen = veri.basvurular.filter((b) => b.status === 'pending').sort((a, b) => new Date(a.applied_at) - new Date(b.applied_at))

    // Son hareketler: gerçek kayıtlardan (katılım, davet, başvuru, karar).
    const olaylar = []
    for (const u of veri.uyeler) {
      if (u.status === 'invited') olaylar.push({ t: u.joined_at, ton: 'vurgu', ad: u.name, metin: 'kişisine üyelik daveti gönderildi' })
      else if (u.accepted_at) olaylar.push({ t: u.accepted_at, ton: 'aksan', ad: u.name, metin: 'kuruma katıldı' })
    }
    for (const b of veri.basvurular) {
      olaylar.push({ t: b.applied_at, ton: 'notr', ad: b.applicant_name, metin: 'başvuru formunu doldurdu' })
      if (b.reviewed_at && b.status !== 'pending') {
        olaylar.push({ t: b.reviewed_at, ton: b.status === 'approved' ? 'aksan' : 'notr', ad: b.applicant_name, metin: b.status === 'approved' ? 'başvurusu onaylandı' : 'başvurusu reddedildi' })
      }
    }
    olaylar.sort((a, b) => new Date(b.t) - new Date(a.t))

    return { toplam: kurum.member_count ?? kabul.length, buAy, yoneticiler, aktif, gor, rehber, bekleyen, olaylar: olaylar.filter((o) => o.t).slice(0, 5) }
  }, [veri, kurum.member_count])

  const onayla = async (b) => {
    setIslenen(b.id)
    try {
      const s = await basvuruSonuclandir(b.id, 'approved')
      bildir(s.hesap_bagli ? `${b.applicant_name} QRtım hesabıyla üye olarak eklendi.` : `${b.applicant_name} üye olarak eklendi (QRtım hesabı yok; kayıt başvuru bilgileriyle açıldı).`, 'success')
      yenile()
      yenileKurumlar()
    } catch (e) {
      bildir(e.message, 'error')
    } finally {
      setIslenen(null)
    }
  }

  const qrIndir = async () => {
    try {
      const url = await QRCode.toDataURL(kurumAdresi(kurum.id, 'apply'), { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      const a = document.createElement('a')
      a.href = url
      a.download = `basvuru-formu-qr.png`
      a.click()
    } catch {
      bildir('QR oluşturulamadı.', 'error')
    }
  }
  const kopyala = async (adres) => {
    try { await navigator.clipboard.writeText(adres); bildir('Bağlantı kopyalandı.', 'success') } catch { bildir('Kopyalanamadı.', 'error') }
  }

  const dizinAcik = dizinAcikMi(kurum)
  const kayitYili = kurum.created_at ? new Date(kurum.created_at).getFullYear() : null
  const plan = veri?.plan?.ok ? veri.plan : null

  return (
    <>
      {/* Başlık */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="flex gap-3.5 items-center min-w-0">
          <KurumLogo kurum={kurum} boyut={56} />
          <div className="min-w-0">
            <h1 className="font-baslik text-2xl font-extrabold leading-tight tracking-tight text-metin">{kurum.name}</h1>
            <div className="flex gap-2 items-center mt-1.5 flex-wrap">
              {kurum.is_stk && <Rozet ton="aksan">STK</Rozet>}
              <Rozet>{turAdi(kurum.type)}</Rozet>
              {!yonetici && <Rozet ton="koyu">Üyesiniz</Rozet>}
              <span className="text-xs text-metin-2">{[veri?.sehir, kayitYili && `QRtım kaydı ${kayitYili}`].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
        </div>
        {yonetici && (
          <div className="flex gap-2 flex-wrap">
            {kurum.is_stk && dizinAcik && (
              <Dugme as="a" href={kurumAdresi(kurum.id, 'members')} target="_blank" rel="noopener noreferrer" ikon={ExternalLink}>Üye dizini</Dugme>
            )}
            {kurum.is_stk && (
              <Dugme as="a" href={kurumAdresi(kurum.id, 'apply')} target="_blank" rel="noopener noreferrer">Başvuru formu</Dugme>
            )}
            <Dugme tur="ana" onClick={() => setDavetAcik(true)}>Üye davet et</Dugme>
          </div>
        )}
      </div>

      {yukleniyor && !veri ? <Yukleniyor /> : !ozet ? null : (
        <>
          {/* İstatistikler */}
          {yonetici ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Istatistik etiket="Toplam üye" deger={sayi(ozet.toplam)} alt={ozet.buAy ? `+${sayi(ozet.buAy)} bu ay` : 'Bu ay yeni üye yok'} altTon={ozet.buAy ? 'olumlu' : 'notr'} />
              {kurum.is_stk ? (
                <Istatistik
                  etiket="Bekleyen başvuru"
                  deger={sayi(ozet.bekleyen.length)}
                  vurgu={ozet.bekleyen.length ? 'vurgu' : undefined}
                  alt={ozet.bekleyen.length ? `En eskisi ${goreli(ozet.bekleyen[0].applied_at)}` : 'Bekleyen başvuru yok'}
                  altTon={ozet.bekleyen.length ? 'vurgu' : 'notr'}
                  onClick={() => bolumSec('basvurular')}
                />
              ) : (
                <Istatistik etiket="Yönetici" deger={sayi(ozet.yoneticiler.length)} alt={`${sayi(ozet.aktif)} aktif üye`} />
              )}
              <Istatistik
                etiket="Üye kartı görüntülenme · 30 gün"
                deger={sayi(ozet.gor)}
                alt={ozet.toplam ? `Üye başına ${sayi(Math.round(ozet.gor / ozet.toplam))}` : undefined}
                onClick={() => bolumSec('olcum')}
              />
              <Istatistik
                etiket="Rehbere kaydetme · 30 gün"
                deger={sayi(ozet.rehber)}
                alt={ozet.gor ? `${yuzde(ozet.rehber, ozet.gor)} görüntülenmeden` : 'Henüz görüntülenme yok'}
                onClick={() => bolumSec('olcum')}
              />
            </div>
          ) : (
            <Kart className="p-5 text-sm text-metin-2">
              Bu kurumda üyesiniz. Üye yönetimi, başvurular ve ölçüm kurum yöneticilerinde; aşağıda yöneticileri görebilirsiniz.
            </Kart>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 items-start">
            {/* Sol sütun */}
            <div className="flex flex-col gap-5 min-w-0">
              {yonetici && kurum.is_stk && (
                <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="kg-bas">
                  <KartBas id="kg-bas" sag={<button type="button" onClick={() => bolumSec('basvurular')} className="text-[13px] font-semibold text-aksan hover:underline">Tümü ({sayi(ozet.bekleyen.length)})</button>}>
                    Bekleyen başvurular
                  </KartBas>
                  {ozet.bekleyen.length === 0 ? (
                    <p className="text-[13px] text-metin-2 py-2">Bekleyen başvuru yok. Başvuru formu bağlantısını paylaştığınızda gelen başvurular burada görünür.</p>
                  ) : (
                    <div className="flex flex-col">
                      {ozet.bekleyen.slice(0, 3).map((b) => (
                        <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-cizgi/70 last:border-0 flex-wrap sm:flex-nowrap">
                          <Avatar ad={b.applicant_name} boyut={34} />
                          <div className="flex-1 min-w-0">
                            <b className="block font-semibold text-metin truncate">{b.applicant_name}</b>
                            <div className="text-xs text-metin-2 truncate">{[b.applicant_email, goreli(b.applied_at)].filter(Boolean).join(' · ')}</div>
                          </div>
                          <div className="flex gap-1.5 ml-auto">
                            <Dugme boyut="k" onClick={() => bolumSec('basvurular', { basvuru: b.id })}>İncele</Dugme>
                            <Dugme boyut="k" tur="ana" disabled={islenen === b.id} onClick={() => onayla(b)}>Onayla</Dugme>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Kart>
              )}

              {yonetici && (
                <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="kg-hareket">
                  <KartBas id="kg-hareket">Son hareketler</KartBas>
                  {ozet.olaylar.length === 0 ? (
                    <p className="text-[13px] text-metin-2">Henüz kayıtlı hareket yok.</p>
                  ) : (
                    <ul className="flex flex-col text-[13px]">
                      {ozet.olaylar.map((o, i) => (
                        <li key={i} className="flex items-center gap-3 py-2.5 border-b border-cizgi/70 last:border-0">
                          <span className={o.ton === 'aksan' ? 'w-2 h-2 rounded-full shrink-0 bg-aksan' : o.ton === 'vurgu' ? 'w-2 h-2 rounded-full shrink-0 bg-vurgu' : 'w-2 h-2 rounded-full shrink-0 bg-metin-2/50'} aria-hidden="true" />
                          <span className="flex-1 min-w-0 text-metin"><b className="font-semibold">{o.ad}</b> {o.metin}</span>
                          <span className="text-metin-2 whitespace-nowrap">{goreli(o.t)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Kart>
              )}
            </div>

            {/* Sağ sütun */}
            <div className="flex flex-col gap-5 min-w-0">
              {yonetici && (
                <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="kg-acik">
                  <KartBas id="kg-acik">Herkese açık sayfalar</KartBas>
                  {!kurum.is_stk ? (
                    <p className="text-[13px] text-metin-2">
                      Üye dizini ve başvuru formu dernek, vakıf, topluluk ve sendika türündeki kurumlarda açılır. Kurum türünü{' '}
                      <button type="button" className="font-semibold text-aksan hover:underline" onClick={() => bolumSec('profil')}>Kurum profili</button>’nden değiştirebilirsiniz.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div className="border border-cizgi rounded-xl p-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center gap-2"><b className="text-[13px] font-semibold">Üye dizini</b>{dizinAcik ? <Rozet ton="aksan">Açık</Rozet> : <Rozet>Kapalı</Rozet>}</div>
                        <span className="font-mono text-xs text-metin-2 truncate">{kisaAdres(kurumAdresi(kurum.id, 'members'))}</span>
                        <span className="text-xs text-metin-2">
                          {dizinAcik
                            ? `Kurumdaki ${sayi(ozet.aktif)} aktif üye listelenir; pasif üyeler görünmez.`
                            : 'Kapalıyken bağlantıyı açan kişi boş liste görür.'}
                          {' '}
                          <button type="button" className="font-semibold text-aksan hover:underline" onClick={() => bolumSec('ayarlar')}>Ayarla</button>
                        </span>
                      </div>
                      <div className="border border-cizgi rounded-xl p-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center gap-2"><b className="text-[13px] font-semibold">Başvuru formu</b><Rozet ton="aksan">Açık</Rozet></div>
                        <span className="font-mono text-xs text-metin-2 truncate">{kisaAdres(kurumAdresi(kurum.id, 'apply'))}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          <Dugme boyut="k" ikon={QrCode} onClick={qrIndir}>QR indir</Dugme>
                          <Dugme boyut="k" tur="sessiz" ikon={Copy} onClick={() => kopyala(kurumAdresi(kurum.id, 'apply'))}>Bağlantıyı kopyala</Dugme>
                        </div>
                      </div>
                    </div>
                  )}
                </Kart>
              )}

              {yonetici && plan && (
                <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="kg-plan">
                  <KartBas id="kg-plan" sag={<button type="button" onClick={() => bireyseleGec('hesap')} className="text-[13px] font-semibold text-aksan hover:underline">Yönet</button>}>
                    Plan kullanımı
                  </KartBas>
                  <div className="flex flex-col gap-2.5 text-[13px]">
                    <div className="flex justify-between"><span>Planınız</span><b>{PLAN_AD[plan.plan] || plan.plan}</b></div>
                    <div className="flex justify-between"><span>Üye</span><b className="tabular-nums">{sayi(ozet.toplam)} · sınırsız</b></div>
                    <div className="flex justify-between"><span>Yönetici</span><b className="tabular-nums">{sayi(ozet.yoneticiler.length)}</b></div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>Yönettiğiniz kurum</span>
                        <b className="tabular-nums">{sayi(plan.kullanim?.organizasyon)} / {Number(plan.sinir?.organizasyon) >= 999 ? 'sınırsız' : sayi(plan.sinir?.organizasyon)}</b>
                      </div>
                      {Number(plan.sinir?.organizasyon) < 999 && <Ilerleme oran={(plan.kullanim?.organizasyon || 0) / (plan.sinir?.organizasyon || 1)} etiket="Kurum hakkı kullanımı" />}
                    </div>
                    {Number(plan.sinir?.nfc_yillik) > 0 && (
                      <div className="flex justify-between"><span>Yıllık NFC kart hakkı</span><b className="tabular-nums">{sayi(plan.sinir.nfc_yillik)} kart</b></div>
                    )}
                  </div>
                </Kart>
              )}

              <Kart className="p-5 flex flex-col gap-2" aria-labelledby="kg-rol">
                <KartBas id="kg-rol">Yöneticiler</KartBas>
                <div className="flex flex-col">
                  {ozet.yoneticiler.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 py-2 border-b border-cizgi/70 last:border-0">
                      <Avatar ad={u.name} url={u.avatar_url} boyut={34} />
                      <span className="flex-1 min-w-0 truncate"><b className="font-semibold">{u.name || 'İsimsiz'}</b>{u.is_me && <span className="text-xs text-metin-2"> · siz</span>}</span>
                    </div>
                  ))}
                </div>
              </Kart>
            </div>
          </div>
        </>
      )}

      {yonetici && <DavetPenceresi acik={davetAcik} kurum={kurum} onKapat={() => setDavetAcik(false)} onGonderildi={yenile} bildir={bildir} />}
    </>
  )
}
