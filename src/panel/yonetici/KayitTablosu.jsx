// Yönetici kayıt tablosu — tasarımdaki sekmeli tablo (Kullanıcılar /
// Abonelikler / Komisyonlar / Referanslar) ve ayrı sayfalardaki tek türlü
// hâli. Filtre durumu üst bileşende tutulur: "Dikkat gerektiren" satırları
// tabloyu doğrudan ilgili filtreye götürebilsin.
import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { Kart, Rozet, Avatar, Dugme, Secim, Tablo, Th, Td, BosDurum } from '../ui'
import { sayi, tl, tarih, birlestir } from '../bicim'
import {
  PLANLAR, planBul, ABONELIK_DURUM, KOMISYON_DURUM, REFERANS_DURUM, ROL_AD, KURUM_TUR,
  SAYFA_BOYU, TURLER, durumBul, yakindaBitiyor,
} from './veri'

const ABONELIK_FILTRE = [
  { deger: 'active', ad: 'Aktif' },
  { deger: 'pasif', ad: 'Aktif olmayan' },
  { deger: 'bitiyor', ad: '7 gün içinde bitiyor' },
]
const DURUM_SECENEK = {
  users: [...ABONELIK_FILTRE, { deger: 'aboneliksiz', ad: 'Aboneliği yok' }],
  subs: ABONELIK_FILTRE,
  comms: Object.entries(KOMISYON_DURUM).map(([deger, d]) => ({ deger, ad: d.ad })),
  refs: Object.entries(REFERANS_DURUM).map(([deger, d]) => ({ deger, ad: d.ad })),
}

const icerir = (aranan, ...alanlar) => alanlar.some((a) => a && String(a).toLocaleLowerCase('tr-TR').includes(aranan))

function aboneDurumUyar(s, durum, simdi) {
  if (durum === 'hepsi') return true
  if (durum === 'aboneliksiz') return !s
  if (!s) return false
  if (durum === 'active') return s.status === 'active'
  if (durum === 'pasif') return s.status !== 'active'
  if (durum === 'bitiyor') return yakindaBitiyor(s, simdi)
  return true
}

function satirlariSec(tur, { veri, t, plan, durum, arama }) {
  const q = arama.trim().toLocaleLowerCase('tr-TR')
  const planUyar = (p) => plan === 'hepsi' || planBul(p)?.deger === plan
  if (tur === 'users') {
    return veri.users.filter((u) => {
      const s = t.abonelik.get(u.id)
      return (!q || icerir(q, u.name, u.email, u.username, u.card_code))
        && (plan === 'hepsi' || (s && planUyar(s.plan)))
        && aboneDurumUyar(s, durum, veri.zaman)
    })
  }
  if (tur === 'subs') {
    return veri.subs.filter((s) => (!q || icerir(q, s.profiles?.name, s.profiles?.email))
      && planUyar(s.plan) && aboneDurumUyar(s, durum, veri.zaman))
  }
  if (tur === 'comms') {
    return veri.comms.filter((c) => (!q || icerir(q, c.profiles?.name, c.profiles?.email, c.description))
      && (durum === 'hepsi' || c.status === durum))
  }
  if (tur === 'refs') {
    return veri.refs.filter((r) => (!q || icerir(q, r.referrer?.name, r.referrer?.email, r.referee?.name, r.referee?.email, r.referral_code))
      && (durum === 'hepsi' || r.status === durum))
  }
  return veri.orgs.filter((o) => (!q || icerir(q, o.name)) && (plan === 'hepsi' || o.type === plan))
}

function Kisi({ ad, eposta }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar ad={ad || eposta} boyut={28} />
      <div className="min-w-0">
        <div className="font-semibold text-metin truncate">{ad || 'İsimsiz'}</div>
        {eposta && <div className="text-[11.5px] text-metin-2 truncate">{eposta}</div>}
      </div>
    </div>
  )
}

const PlanRozet = ({ plan }) => {
  const p = planBul(plan)
  return p ? <Rozet ton={p.ton}>{p.ad}</Rozet> : <span className="text-metin-2">—</span>
}

function AcDugmesi({ ad, onClick, disabled }) {
  return (
    <Td className="text-right">
      <Dugme tur="sessiz" boyut="k" onClick={onClick} disabled={disabled} aria-label={`${ad || 'Kayıt'} ayrıntılarını aç`}>
        Aç
      </Dugme>
    </Td>
  )
}

function Satirlar({ tur, satirlar, t, onAc }) {
  if (tur === 'users') {
    return satirlar.map((u) => {
      const s = t.abonelik.get(u.id)
      const d = s ? durumBul(ABONELIK_DURUM, s.status) : null
      const kurumlar = t.kurulanKurum.get(u.id)
      return (
        <tr key={u.id} className="hover:bg-yuzey-2/50">
          <Td><Kisi ad={u.name} eposta={u.email} /></Td>
          <Td className="font-mono text-xs text-metin-2">{u.username || '—'}</Td>
          <Td><PlanRozet plan={s?.plan} /></Td>
          <Td>{d ? <Rozet ton={d.ton}>{d.ad}</Rozet> : <Rozet>Abonelik yok</Rozet>}</Td>
          <Td className="text-metin-2 max-w-[200px] truncate">{kurumlar ? kurumlar.map((o) => o.name).join(', ') : '—'}</Td>
          <Td className="text-metin-2 whitespace-nowrap">{tarih(u.created_at)}</Td>
          <Td sag>{sayi(u.card_views ?? 0)}</Td>
          <Td>
            <span className={birlestir('text-xs font-semibold whitespace-nowrap', u.role === 'admin' || u.role === 'superadmin' ? 'text-vurgu' : 'text-metin-2')}>
              {ROL_AD[u.role] || ROL_AD.user}
            </span>
          </Td>
          <AcDugmesi ad={u.name} onClick={() => onAc(u.id)} />
        </tr>
      )
    })
  }
  if (tur === 'subs') {
    return satirlar.map((s) => {
      const d = durumBul(ABONELIK_DURUM, s.status)
      return (
        <tr key={s.id} className="hover:bg-yuzey-2/50">
          <Td><Kisi ad={s.profiles?.name} eposta={s.profiles?.email} /></Td>
          <Td><PlanRozet plan={s.plan} /></Td>
          <Td className="text-metin-2">{s.plan === 'free' ? '—' : s.billing_cycle === 'yearly' ? 'Yıllık' : 'Aylık'}</Td>
          <Td><Rozet ton={d.ton}>{d.ad}</Rozet></Td>
          <Td sag>{s.nfc_cards_included ? `${sayi(s.nfc_cards_used || 0)} / ${sayi(s.nfc_cards_included)}` : '—'}</Td>
          <Td className="text-metin-2 whitespace-nowrap">{tarih(s.created_at)}</Td>
          <Td className="text-metin-2 whitespace-nowrap">{s.expires_at ? tarih(s.expires_at) : s.plan === 'free' ? '—' : 'Süresiz'}</Td>
          <AcDugmesi ad={s.profiles?.name} onClick={() => onAc(s.profile_id)} />
        </tr>
      )
    })
  }
  if (tur === 'comms') {
    return satirlar.map((c) => {
      const d = durumBul(KOMISYON_DURUM, c.status)
      return (
        <tr key={c.id} className="hover:bg-yuzey-2/50">
          <Td><Kisi ad={c.profiles?.name} eposta={c.profiles?.email} /></Td>
          <Td className="text-metin-2 max-w-[280px] truncate">{c.description || '—'}</Td>
          <Td sag className="font-semibold">{tl(parseFloat(c.amount || 0))}</Td>
          <Td><Rozet ton={d.ton}>{d.ad}</Rozet></Td>
          <Td className="text-metin-2 whitespace-nowrap">{tarih(c.created_at)}</Td>
          <AcDugmesi ad={c.profiles?.name} onClick={() => onAc(c.profile_id)} />
        </tr>
      )
    })
  }
  if (tur === 'refs') {
    return satirlar.map((r) => {
      const d = durumBul(REFERANS_DURUM, r.status)
      return (
        <tr key={r.id} className="hover:bg-yuzey-2/50">
          <Td><Kisi ad={r.referrer?.name} eposta={r.referrer?.email} /></Td>
          <Td>{r.referee ? <Kisi ad={r.referee.name} eposta={r.referee.email} /> : <span className="text-metin-2">Hesap silinmiş</span>}</Td>
          <Td className="font-mono text-xs text-metin-2">{r.referral_code || '—'}</Td>
          <Td><Rozet ton={d.ton}>{d.ad}</Rozet></Td>
          <Td sag>{r.commission_amount > 0 ? tl(parseFloat(r.commission_amount)) : '—'}</Td>
          <Td className="text-metin-2 whitespace-nowrap">{tarih(r.created_at)}</Td>
          <AcDugmesi ad={r.referrer?.name} onClick={() => onAc(r.referrer_id)} disabled={!r.referrer_id} />
        </tr>
      )
    })
  }
  return satirlar.map((o) => {
    const kuran = o.created_by ? t.kisi.get(o.created_by) : null
    return (
      <tr key={o.id} className="hover:bg-yuzey-2/50">
        <Td>
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar ad={o.name} boyut={28} kare />
            <span className="font-semibold text-metin truncate">{o.name}</span>
          </div>
        </Td>
        <Td className="text-metin-2">{KURUM_TUR[o.type] || o.type || '—'}</Td>
        <Td sag>{sayi(o.member_count ?? 0)}</Td>
        <Td>{kuran ? <Kisi ad={kuran.name} eposta={kuran.email} /> : <span className="text-metin-2">—</span>}</Td>
        <Td className="text-metin-2 whitespace-nowrap">{tarih(o.created_at)}</Td>
        <AcDugmesi ad={kuran?.name} onClick={() => onAc(o.created_by)} disabled={!kuran} />
      </tr>
    )
  })
}

const BASLIKLAR = {
  users: [['Kullanıcı'], ['Kart'], ['Plan'], ['Durum'], ['Kurduğu kurum'], ['Kayıt'], ['Görüntülenme', true], ['Rol']],
  subs: [['Kullanıcı'], ['Plan'], ['Dönem'], ['Durum'], ['NFC hakkı', true], ['Başlangıç'], ['Bitiş']],
  comms: [['Kişi'], ['Açıklama'], ['Tutar', true], ['Durum'], ['Tarih']],
  refs: [['Davet eden'], ['Davetli'], ['Kod'], ['Durum'], ['Komisyon', true], ['Tarih']],
  orgs: [['Kurum'], ['Tür'], ['Üye', true], ['Kuran'], ['Kuruluş']],
}
const BOS_METIN = {
  users: 'Kullanıcı bulunamadı', subs: 'Abonelik bulunamadı', comms: 'Komisyon bulunamadı',
  refs: 'Referans bulunamadı', orgs: 'Kurum bulunamadı',
}

export default function KayitTablosu({
  tur, sekmeli, onTur, plan, onPlan, durum, onDurum, arama, onArama, veri, t, onAc, etiket,
}) {
  const [sayfa, setSayfa] = useState(0)
  const satirlar = useMemo(() => satirlariSec(tur, { veri, t, plan, durum, arama }), [tur, veri, t, plan, durum, arama])
  const toplam = satirlar.length
  const sonSayfa = Math.max(0, Math.ceil(toplam / SAYFA_BOYU) - 1)
  const gecerliSayfa = Math.min(sayfa, sonSayfa)
  const gorunen = satirlar.slice(gecerliSayfa * SAYFA_BOYU, (gecerliSayfa + 1) * SAYFA_BOYU)
  const planFiltreli = tur === 'users' || tur === 'subs' || tur === 'orgs'
  const durumSecenek = DURUM_SECENEK[tur]

  // Filtre ya da arama değişince ilk sayfaya dön (olay anında, effect'te değil).
  const filtre = (fn) => (v) => { setSayfa(0); fn(v) }

  return (
    <Kart aria-label={etiket || TURLER.find((x) => x.deger === tur)?.ad}>
      <div className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap border-b border-cizgi/70">
        {sekmeli ? (
          <div role="tablist" aria-label="Kayıt türü" className="inline-flex bg-yuzey-2 rounded-[10px] p-[3px] gap-0.5 max-w-full overflow-x-auto">
            {TURLER.map((x) => {
              const sec = x.deger === tur
              return (
                <button
                  key={x.deger}
                  type="button"
                  role="tab"
                  aria-selected={sec}
                  onClick={() => { setSayfa(0); onTur(x.deger) }}
                  className={birlestir(
                    'h-9 px-3.5 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
                    sec ? 'bg-yuzey text-metin shadow-sm' : 'text-metin-2 hover:text-metin',
                  )}
                >
                  {x.ad}
                  {sec && <span className="opacity-60 tabular-nums">{sayi(toplam)}</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <span className="text-[13px] text-metin-2"><b className="text-metin tabular-nums">{sayi(toplam)}</b> kayıt</span>
        )}
        <div className="flex gap-2 items-center flex-wrap">
          {/* Mobilde üst çubuktaki arama kutusu gizli; aynı arama burada. */}
          <label className="relative md:hidden flex-1 min-w-[180px]">
            <span className="sr-only">Ara</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-metin-2" aria-hidden="true" />
            <input
              type="search"
              value={arama}
              onChange={(e) => filtre(onArama)(e.target.value)}
              placeholder="Ara…"
              className="h-9 w-full rounded-lg border border-cizgi bg-yuzey pl-8 pr-3 text-[13px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40"
            />
          </label>
          {planFiltreli && (
            <Secim etiket={tur === 'orgs' ? 'Kurum türü filtresi' : 'Plan filtresi'} value={plan} onChange={filtre(onPlan)}>
              {tur === 'orgs' ? (
                <>
                  <option value="hepsi">Tüm türler</option>
                  {Object.entries(KURUM_TUR).map(([d, ad]) => <option key={d} value={d}>{ad}</option>)}
                </>
              ) : (
                <>
                  <option value="hepsi">Tüm planlar</option>
                  {PLANLAR.map((p) => <option key={p.deger} value={p.deger}>{p.ad}</option>)}
                </>
              )}
            </Secim>
          )}
          {durumSecenek && (
            <Secim etiket="Durum filtresi" value={durum} onChange={filtre(onDurum)}>
              <option value="hepsi">Tüm durumlar</option>
              {durumSecenek.map((d) => <option key={d.deger} value={d.deger}>{d.ad}</option>)}
            </Secim>
          )}
        </div>
      </div>

      {toplam === 0 ? (
        <BosDurum ikon={Users} baslik={BOS_METIN[tur]} aciklama={arama || plan !== 'hepsi' || durum !== 'hepsi' ? 'Arama ya da filtreleri değiştirip yeniden deneyin.' : null} />
      ) : (
        // relative: başlıktaki sr-only metin kaydırma kutusunun içinde kalsın;
        // yoksa mutlak konumlu olduğu için sayfayı mobilde yatay taşırıyor.
        <Tablo className="relative [&_td]:py-2.5 [&_td]:px-3 [&_th]:px-3 [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
          <thead>
            <tr>
              {BASLIKLAR[tur].map(([ad, sag]) => <Th key={ad} sag={sag}>{ad}</Th>)}
              <Th><span className="sr-only">İşlem</span></Th>
            </tr>
          </thead>
          <tbody>
            <Satirlar tur={tur} satirlar={gorunen} t={t} onAc={onAc} />
          </tbody>
        </Tablo>
      )}

      <div className="flex justify-between items-center gap-3 px-4 py-2.5 text-xs text-metin-2 flex-wrap">
        <span className="tabular-nums">
          {toplam ? `${sayi(gecerliSayfa * SAYFA_BOYU + 1)}–${sayi(gecerliSayfa * SAYFA_BOYU + gorunen.length)}` : '0'} / {sayi(toplam)} · sayfa başına {SAYFA_BOYU}
        </span>
        <div className="flex gap-1.5">
          <Dugme boyut="k" disabled={gecerliSayfa === 0} onClick={() => setSayfa(gecerliSayfa - 1)}>Önceki</Dugme>
          <Dugme boyut="k" disabled={gecerliSayfa >= sonSayfa} onClick={() => setSayfa(gecerliSayfa + 1)}>Sonraki</Dugme>
        </div>
      </div>
    </Kart>
  )
}
