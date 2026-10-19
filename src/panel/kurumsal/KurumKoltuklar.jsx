// KOLTUK DAĞITIMI — kurumun satın aldığı abonelik koltuklarını üyelere verme.
//
// Kotayı platform yöneticisi tanımlıyor (toplu alım teklifle yürüyor,
// platformda adetli satın alma yok). Dağıtımı kurum yöneticisi burada yapar.
//
// Koltuk, üyenin KENDİ aboneliğine dokunmaz: plan çözümlemesi (gecerli_plan)
// kişisel abonelik ile koltuğun İYİSİNİ seçiyor. Yani koltuk kalkınca kişi
// kendi planına döner, ücretsizse ücretsize — kimsenin satın aldığı plan
// kaybolmaz. Bu yüzden geri alma güvenli bir işlem.
import { useCallback, useState } from 'react'
import { Armchair, Check, Minus } from 'lucide-react'
import { useVeri, rpc } from './veri'
import { SayfaBas } from './ortak'
import { Kart, KartBaslik, Dugme, Rozet, Satir, Avatar, Yukleniyor, BosDurum } from '../ui'
import { sayi, tarih, birlestir } from '../bicim'

const HATALAR = {
  oturum_yok: 'Oturumunuzun süresi dolmuş. Sayfayı yenileyin.',
  yetkisiz: 'Bu işlem için kurum yöneticisi olmanız gerekiyor.',
  kota_yok: 'Kurumun koltuk kotası yok. Toplu abonelik için bizimle iletişime geçin.',
  kota_suresi_doldu: 'Koltuk kotanızın süresi dolmuş. Yenilemek için iletişime geçin.',
  kota_dolu: 'Tüm koltuklar dağıtılmış. Yeni koltuk vermek için önce birinden geri alın.',
  uye_degil: 'Bu kişi kurumun kabul edilmiş üyesi değil.',
  koltuk_zaten_var: 'Bu üyede zaten açık bir koltuk var.',
  koltuk_bulunamadi: 'Açık koltuk bulunamadı; zaten geri alınmış olabilir.',
}

const PLAN_AD = {
  student: 'Öğrenci', professional: 'Profesyonel', stk: 'STK Özel',
  business: 'Kurumsal', corporate: 'Kurumsal',
}

export default function KurumKoltuklar({ kurum, bildir }) {
  const yukle = useCallback(() => rpc('org_seats_list', { p_org_id: kurum.id }), [kurum.id])
  const { veri, yukleniyor, hata, yenile } = useVeri(yukle)
  const [mesgul, setMesgul] = useState(null)

  const calistir = async (ad, govde, basari, profilId) => {
    setMesgul(profilId)
    try {
      const sonuc = await rpc(ad, govde)
      if (!sonuc?.ok) {
        bildir(HATALAR[sonuc?.hata] || `İşlem tamamlanamadı (${sonuc?.hata || 'bilinmeyen'})`, 'error')
        return
      }
      bildir(basari, 'success')
      yenile()
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setMesgul(null)
    }
  }

  if (yukleniyor) return <Yukleniyor />
  if (hata || !veri?.ok) {
    return (
      <>
        <SayfaBas baslik="Koltuklar" />
        <Kart className="p-5">
          <p className="text-[13px] text-metin-2">
            {HATALAR[veri?.hata] || 'Koltuk bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin.'}
          </p>
        </Kart>
      </>
    )
  }

  const { kota, plan, kota_bitis: bitis, acik_koltuk: acik, kalan, uyeler } = veri
  const kotaVar = kota > 0
  const suresiDoldu = bitis && new Date(bitis) <= new Date()

  return (
    <>
      <SayfaBas
        baslik="Koltuklar"
        alt="Satın aldığınız abonelik koltuklarını üyelerinize dağıtın. Koltuk kalkınca üye kendi planına döner."
      />

      <Kart className="p-5 flex flex-col gap-3" aria-labelledby="koltuk-ozet">
        <KartBaslik
          id="koltuk-ozet"
          baslik={kotaVar ? `${sayi(acik)} / ${sayi(kota)} koltuk kullanılıyor` : 'Koltuk kotanız yok'}
          alt={kotaVar
            ? `${PLAN_AD[plan] || plan} kademesi${bitis ? ` · ${tarih(bitis)} tarihine kadar` : ''}`
            : 'Toplu abonelik teklifi için bizimle iletişime geçin; kota tanımlandığında koltukları buradan dağıtırsınız.'}
          ikon={<span className="w-10 h-10 rounded-[10px] bg-murekkep text-yuzey inline-flex items-center justify-center shrink-0"><Armchair size={20} aria-hidden="true" /></span>}
          sag={kotaVar ? <Rozet ton={kalan > 0 ? 'aksan' : 'notr'}>{sayi(kalan)} boş</Rozet> : (
            <Dugme as="a" href="/iletisim?konu=Kurumsal%20%2F%20STK%20Teklif" tur="ikincil" boyut="k">Teklif isteyin</Dugme>
          )}
        />
        {suresiDoldu && (
          <p className="text-[13px] text-red-600 dark:text-red-400">
            Kotanın süresi dolmuş: dağıtılmış koltuklar geçersiz. Yenilemek için iletişime geçin.
          </p>
        )}
      </Kart>

      <Kart aria-labelledby="koltuk-uyeler">
        <div className="px-5 py-4 border-b border-cizgi">
          <KartBaslik id="koltuk-uyeler" baslik="Üyeler" alt="Koltuğu olanlar üstte." />
        </div>
        {!uyeler?.length ? (
          <div className="p-5">
            <BosDurum
              baslik="Kabul edilmiş üye yok"
              aciklama="Koltuk yalnız daveti kabul etmiş üyelere verilebilir. Üyeler bölümünden davet gönderin."
            />
          </div>
        ) : (
          <div className="px-5 py-2">
            {uyeler.map((u) => {
              const varMi = u.koltuk_var
              const bu = mesgul === u.profile_id
              return (
                <Satir key={u.profile_id}>
                  <Avatar ad={u.ad || u.eposta} boyut={36} />
                  <div className="flex-1 min-w-0">
                    <b className="text-sm block truncate">{u.ad || u.eposta || 'İsimsiz'}</b>
                    <div className="text-xs text-metin-2 truncate">
                      {varMi
                        ? `${PLAN_AD[u.koltuk_plan] || u.koltuk_plan}${u.koltuk_bitis ? ` · ${tarih(u.koltuk_bitis)} sonuna kadar` : ''}`
                        : u.eposta || '—'}
                    </div>
                  </div>
                  {varMi && <Rozet ton="aksan" ikon={Check}>Koltuk var</Rozet>}
                  {varMi ? (
                    <Dugme
                      tur="ikincil" boyut="k" ikon={Minus} disabled={!!mesgul}
                      onClick={() => calistir('org_seat_revoke',
                        { p_org_id: kurum.id, p_profile_id: u.profile_id, p_reason: null },
                        `${u.ad || 'Üye'} koltuğu geri alındı`, u.profile_id)}
                    >
                      {bu ? 'İşleniyor…' : 'Geri al'}
                    </Dugme>
                  ) : (
                    <Dugme
                      tur="ana" boyut="k" disabled={!!mesgul || !kotaVar || kalan <= 0 || suresiDoldu}
                      onClick={() => calistir('org_seat_grant',
                        { p_org_id: kurum.id, p_profile_id: u.profile_id },
                        `${u.ad || 'Üye'} için koltuk tanımlandı`, u.profile_id)}
                    >
                      {bu ? 'İşleniyor…' : 'Koltuk ver'}
                    </Dugme>
                  )}
                </Satir>
              )
            })}
          </div>
        )}
        {kotaVar && kalan <= 0 && (
          <p className={birlestir('px-5 py-3 text-xs text-metin-2 border-t border-cizgi')}>
            Tüm koltuklar dağıtılmış. Yeni bir üyeye vermek için önce birinden geri alın ya da kota artırımı için
            iletişime geçin.
          </p>
        )}
      </Kart>
    </>
  )
}
