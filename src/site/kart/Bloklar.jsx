// Kartın içerik blokları. Her blok yalnız verisi varsa çizilir; görünürlük
// süzgeci sunucuda (build_public_card) uygulanır — gizli alan istemciye hiç
// gelmez, burada ayrıca gizleme yapılmaz.
import { useState } from 'react'
import {
  BadgeCheck, CalendarDays, Check, ChevronDown, ChevronUp, CreditCard, Download, ExternalLink, FileText,
  Globe, Landmark, Mail, MapPin, Phone, Star, UserPlus,
} from 'lucide-react'
import { basHarf, birlestir, tl } from '../../panel/bicim'
import { trackCardEvent } from '../../utils/analyticsHelpers'
import {
  BTN, BTN_ANA, BTN_IKINCIL, ODAK, ROL_ADI, YONTEM_ACIKLAMA, adresGoster, ibanBicim, panoyaKopyala,
  platformBilgisi, rozetBilgisi, safeUrl, tarihKisa,
} from './yardim'
import { Blok, KopyalaDugmesi, Satir, SimgeKutu } from './parcalar'

// ---------------------------------------------------------------- eylemler
export function Eylemler({ duzen, randevuVar, onRehber, onRandevu }) {
  const cuzdanYazi = (
    <>
      <CreditCard size={18} aria-hidden="true" className="shrink-0" />
      <span>Cüzdana ekle{duzen === 'bireysel' && randevuVar ? ' (Apple / Google)' : ''}</span>
      <span className="text-[10px] font-semibold rounded-full bg-yuzey-2 text-metin-2 px-1.5 py-px">Yakında</span>
    </>
  )
  const rehber = (
    <button type="button" onClick={onRehber} className={birlestir(BTN, BTN_ANA, 'flex-1')}>
      <UserPlus size={18} aria-hidden="true" />Rehbere kaydet
    </button>
  )
  // Bireysel düzende randevu açıksa ikinci düğme "Randevu al", cüzdan altta
  // kesik çizgili satır; aksi hâlde cüzdan ikinci düğmenin yerini alır.
  if (duzen === 'bireysel' && randevuVar) {
    return (
      <>
        <div className="flex gap-2.5">
          {rehber}
          <button type="button" onClick={onRandevu} className={birlestir(BTN, BTN_IKINCIL, 'flex-1')}>
            <CalendarDays size={18} aria-hidden="true" />Randevu al
          </button>
        </div>
        {/* Cüzdan kartı henüz yok: düğme devre dışı, "Yakında" rozetli. */}
        <button type="button" disabled aria-disabled="true" className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-cizgi bg-yuzey text-[13px] font-semibold text-metin-2 cursor-not-allowed">
          {cuzdanYazi}
        </button>
      </>
    )
  }
  return (
    <div className="flex gap-2.5">
      {rehber}
      <button type="button" disabled aria-disabled="true" className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-12 px-2 rounded-xl border border-cizgi bg-yuzey text-[13px] font-semibold text-metin-2 whitespace-nowrap cursor-not-allowed">
        {cuzdanYazi}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- doğrulama
// Rozet genel bir "onaylı hesap" tiki DEĞİL: her satır neyin, nasıl ve ne
// zaman doğrulandığını söyler; ziyaretçi rozetin ağırlığına kendisi karar verir.
export function Dogrulama({ dogrulamalar, acik, onToggle }) {
  return (
    <section id="kart-dogrulama" aria-labelledby="kart-dogrulama-b" className="rounded-2xl border border-aksan/25 bg-aksan-acik/50 dark:bg-aksan-acik/70 dark:border-aksan/30 p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 id="kart-dogrulama-b" className="font-baslik text-[13px] font-bold tracking-[0.06em] uppercase text-aksan-koyu dark:text-aksan">Doğrulama ayrıntısı</h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={acik}
          aria-label={acik ? 'Doğrulama ayrıntısını kapat' : 'Doğrulama ayrıntısını aç'}
          className={birlestir('w-8 h-8 -mr-1 rounded-lg inline-flex items-center justify-center text-metin-2 hover:text-metin', ODAK)}
        >
          {acik ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>
      {acik && (
        <>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            {dogrulamalar.map((d, i) => {
              const r = rozetBilgisi(d)
              const t = tarihKisa(d.dogrulandi_at)
              return (
                <li key={`${d.tur}-${i}`} className="flex gap-2.5 items-start">
                  <Check size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-aksan" />
                  <div className="min-w-0">
                    {/* Kutuda TAM değer: kısaltma yalnızca çipte. */}
                    <b className="text-metin font-semibold break-all">{r.baslik}</b>
                    <div className="text-metin-2">
                      {YONTEM_ACIKLAMA[d.yontem] || 'Doğrulandı.'}
                      {d.tur === 'kurum' && d.kurum_alan_adi && ` Kurumun alan adı: ${d.kurum_alan_adi}.`}
                      {t && ` ${t}.`}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {/* Rozetin sınırını açıkça söylüyoruz: sahte güven gerçek güvenden tehlikelidir. */}
          <p className="text-xs text-metin-2 leading-relaxed">
            Bu rozetler yalnız yukarıda yazanları doğrular. QRtım kişinin kimliğine kefil olmaz; neyi, nasıl ve ne zaman kontrol ettiğini gösterir.
          </p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- iletişim
export function Iletisim({ fields }) {
  const web = safeUrl(fields.website)
  if (!fields.phone && !fields.email && !web) return null
  return (
    <Blok aria-label="İletişim">
      {fields.phone && (
        <Satir ikon={Phone} etiket="Telefon" deger={fields.phone} href={`tel:${String(fields.phone).replace(/[^\d+]/g, '')}`}
          sag={<KopyalaDugmesi metin={fields.phone} etiket="Telefonu kopyala" basari="Telefon kopyalandı" />} />
      )}
      {fields.email && (
        <Satir ikon={Mail} etiket="E-posta" deger={fields.email} href={`mailto:${fields.email}`}
          sag={<KopyalaDugmesi metin={fields.email} etiket="E-postayı kopyala" basari="E-posta kopyalandı" />} />
      )}
      {web && <Satir ikon={Globe} etiket="Web" deger={adresGoster(fields.website)} href={web} dis />}
    </Blok>
  )
}

// ---------------------------------------------------------------- bağlantılar
function BaglantiKutusu({ link, hedef, genis }) {
  const href = link.whatsapp ? link.url : safeUrl(link.url)
  if (!href) return null
  const b = platformBilgisi(link.platform)
  const Ikon = b.ikon
  const ad = link.etiket || b.ad
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={link.whatsapp ? undefined : () => trackCardEvent('link_click', { ...hedef, meta: { link_id: link.id, label: ad, platform: link.platform } })}
      className={birlestir(
        'flex items-center gap-3 h-12 px-3 rounded-xl bg-zemin text-metin text-[14px] font-semibold hover:bg-yuzey-2 transition-colors min-w-0',
        genis && 'col-span-2', ODAK,
      )}
    >
      <span className={birlestir('w-[30px] h-[30px] rounded-lg inline-flex items-center justify-center shrink-0', b.ton)} aria-hidden="true">
        <Ikon size={16} />
      </span>
      <span className="truncate">{ad}</span>
      {genis && <ExternalLink size={16} aria-hidden="true" className="ml-auto shrink-0 text-metin-2" />}
    </a>
  )
}

export function Baglantilar({ socialLinks, whatsapp, hedef }) {
  const liste = (socialLinks || []).filter((l) => safeUrl(l.url))
  const wa = whatsapp ? String(whatsapp).replace(/[^0-9]/g, '') : ''
  if (!liste.length && !wa) return null
  // Öne çıkarılan bağlantı ikon kalabalığında kaybolmasın diye başlığıyla
  // birlikte tam genişlikte, en üstte gösterilir.
  const one = liste.filter((l) => l.one_cikan)
  const diger = liste.filter((l) => !l.one_cikan)
  return (
    <Blok baslik="Bağlantılar" baslikId="kart-baglanti">
      <div className="grid grid-cols-2 gap-2">
        {one.map((l) => <BaglantiKutusu key={l.id} link={l} hedef={hedef} genis />)}
        {diger.map((l) => <BaglantiKutusu key={l.id} link={l} hedef={hedef} />)}
        {wa && <BaglantiKutusu link={{ id: 'wa', platform: 'whatsapp', url: `https://wa.me/${wa}`, whatsapp: true }} hedef={hedef} />}
      </div>
    </Blok>
  )
}

// ---------------------------------------------------------------- kurumlar
function KurumSatiri({ org, dogrulamalar, sira }) {
  const [acik, setAcik] = useState(false)
  const web = safeUrl(org.website)
  const logo = safeUrl(org.logo_url)
  const kurumRozeti = (dogrulamalar || []).find((d) => d.tur === 'kurum' && d.konu === org.name && d.kurum_alan_adi)
  const alt = [ROL_ADI[org.role] || (org.role ? org.role : null), kurumRozeti ? 'alan adı doğrulandı' : null].filter(Boolean).join(' · ')
  const ayrintiVar = org.description || org.phone || org.email || web || org.city || org.address
  const id = `kurum-${org.id}`

  const ust = (
    <>
      <span className={birlestir('w-9 h-9 rounded-[10px] inline-flex items-center justify-center shrink-0 overflow-hidden font-baslik font-extrabold text-xs', logo ? 'bg-yuzey-2' : sira % 2 ? 'bg-aksan-acik text-aksan-koyu dark:text-aksan' : 'bg-lacivert-900 text-white dark:bg-lacivert-600')} aria-hidden="true">
        {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : basHarf(org.name)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-[14px] text-metin break-words">{org.name}</span>
        {alt && <span className="flex items-center gap-1 text-xs text-metin-2">{kurumRozeti && <BadgeCheck size={12} aria-hidden="true" className="text-aksan" />}{alt}</span>}
      </span>
    </>
  )

  if (!ayrintiVar) return <div className="flex items-center gap-3 min-h-[44px]">{ust}</div>
  return (
    <div>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        aria-expanded={acik}
        aria-controls={id}
        className={birlestir('w-full flex items-center gap-3 min-h-[44px] rounded-xl', ODAK)}
      >
        {ust}
        <ChevronDown size={18} aria-hidden="true" className={birlestir('shrink-0 text-metin-2 transition-transform', acik ? 'rotate-0' : '-rotate-90')} />
      </button>
      {acik && (
        <div id={id} className="mt-2 ml-12 flex flex-col gap-1.5 text-[13px]">
          {org.description && <p className="text-metin-2">{org.description}</p>}
          {org.phone && <a href={`tel:${String(org.phone).replace(/[^\d+]/g, '')}`} className={birlestir('inline-flex items-center gap-2 text-metin hover:text-aksan rounded', ODAK)}><Phone size={14} aria-hidden="true" className="text-aksan" />{org.phone}</a>}
          {org.email && <a href={`mailto:${org.email}`} className={birlestir('inline-flex items-center gap-2 text-metin hover:text-aksan rounded break-all', ODAK)}><Mail size={14} aria-hidden="true" className="text-aksan" />{org.email}</a>}
          {web && <a href={web} target="_blank" rel="noopener noreferrer" className={birlestir('inline-flex items-center gap-2 text-aksan hover:underline rounded break-all', ODAK)}><Globe size={14} aria-hidden="true" />{adresGoster(org.website)}</a>}
          {(org.city || org.address) && <span className="inline-flex items-start gap-2 text-metin-2"><MapPin size={14} aria-hidden="true" className="text-aksan mt-0.5 shrink-0" />{[org.address, org.city].filter(Boolean).join(', ')}</span>}
        </div>
      )}
    </div>
  )
}

export function Kurumlar({ organizations, dogrulamalar }) {
  if (!organizations?.length) return null
  return (
    <Blok baslik="Kurumlar" baslikId="kart-kurum">
      {organizations.map((o, i) => <KurumSatiri key={o.id} org={o} sira={i} dogrulamalar={dogrulamalar} />)}
    </Blok>
  )
}

// ---------------------------------------------------------------- hizmetler
export function Hizmetler({ services }) {
  const liste = Array.isArray(services) ? services.filter((s) => s?.title) : []
  if (!liste.length) return null
  return (
    <Blok baslik="Hizmetler" baslikId="kart-hizmet">
      <ul className="flex flex-col gap-2">
        {liste.map((s, i) => {
          // Fiyat profildeki gerçek değer; girilmemişse fiyat hiç gösterilmez.
          const fiyat = Number(s.price) > 0 ? tl(s.price) : null
          const alt = [s.delivery_time, s.description].filter(Boolean).join(' · ')
          return (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-zemin">
              <div className="min-w-0">
                <div className="font-semibold text-[14px] text-metin">{s.title}</div>
                {alt && <div className="text-xs text-metin-2">{alt}</div>}
              </div>
              {fiyat && <span className="font-baslik font-bold text-[14px] text-metin whitespace-nowrap">{fiyat}</span>}
            </li>
          )
        })}
      </ul>
    </Blok>
  )
}

export function GoogleYorum({ link }) {
  const href = safeUrl(link)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={birlestir('flex items-center gap-3 min-h-[60px] px-4 rounded-2xl border border-cizgi bg-yuzey hover:bg-yuzey-2 transition-colors', ODAK)}>
      <SimgeKutu className="bg-vurgu-acik text-vurgu"><Star size={18} /></SimgeKutu>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[14px] text-metin">Google'da yorum yapın</span>
        <span className="block text-xs text-metin-2">Deneyiminizi paylaşın</span>
      </span>
      <ExternalLink size={16} aria-hidden="true" className="text-metin-2 shrink-0" />
    </a>
  )
}

// ---------------------------------------------------------------- ödeme
export function Odeme({ payment }) {
  const [fatura, setFatura] = useState(false)
  const hesaplar = Array.isArray(payment?.bank_accounts) ? payment.bank_accounts.filter((h) => h?.iban) : []
  const f = payment?.billing_info
  if (!hesaplar.length && !f) return null

  const faturaMetni = f ? [
    f.company_title,
    f.tax_office && `Vergi Dairesi: ${f.tax_office}`,
    f.tax_number && `${f.is_individual ? 'TC' : 'Vergi No'}: ${f.tax_number}`,
    f.address,
  ].filter(Boolean).join('\n') : ''

  return (
    <Blok baslik="Ödeme ve fatura" baslikId="kart-odeme">
      {hesaplar.map((h, i) => (
        <Satir
          key={i}
          ikon={Landmark}
          etiket={['IBAN', h.account_holder].filter(Boolean).join(' · ')}
          deger={<><span className="tabular-nums tracking-[-0.01em] text-[13px]">{ibanBicim(h.iban)}</span>{h.bank_name && <span className="block font-sans font-normal text-xs text-metin-2">{h.bank_name}</span>}</>}
          sag={<KopyalaDugmesi metin={String(h.iban).replace(/\s+/g, '')} etiket="IBAN'ı kopyala" basari="IBAN kopyalandı" />}
        />
      ))}
      {f && (
        <div className="rounded-xl border border-cizgi">
          <button
            type="button"
            onClick={() => setFatura((v) => !v)}
            aria-expanded={fatura}
            aria-controls="kart-fatura"
            className={birlestir('w-full flex items-center justify-between h-11 px-3 rounded-xl text-[14px] font-semibold text-metin', ODAK)}
          >
            <span>{fatura ? 'Fatura bilgilerini gizle' : 'Fatura bilgilerini göster'}</span>
            <ChevronDown size={18} aria-hidden="true" className={birlestir('text-metin-2 transition-transform', fatura && 'rotate-180')} />
          </button>
          {fatura && (
            <div id="kart-fatura" className="px-3 pb-3 flex flex-col gap-2 text-[13px]">
              <dl className="flex flex-col gap-2">
                {f.company_title && <div><dt className="text-xs text-metin-2">Unvan</dt><dd className="font-semibold text-metin">{f.company_title}</dd></div>}
                {f.tax_office && <div><dt className="text-xs text-metin-2">Vergi dairesi</dt><dd className="text-metin">{f.tax_office}</dd></div>}
                {f.tax_number && <div><dt className="text-xs text-metin-2">{f.is_individual ? 'TC kimlik no' : 'Vergi no'}</dt><dd className="font-mono text-metin">{f.tax_number}</dd></div>}
                {f.address && <div><dt className="text-xs text-metin-2">Adres</dt><dd className="text-metin">{f.address}</dd></div>}
              </dl>
              <button type="button" onClick={() => panoyaKopyala(faturaMetni, 'Fatura bilgileri kopyalandı')} className={birlestir('self-start inline-flex items-center h-9 px-3 rounded-[10px] border border-cizgi bg-yuzey text-[13px] font-semibold text-metin hover:bg-yuzey-2', ODAK)}>
                Tümünü kopyala
              </button>
            </div>
          )}
        </div>
      )}
    </Blok>
  )
}

// ---------------------------------------------------------------- katalog
export function Katalog({ links }) {
  const liste = (Array.isArray(links) ? links : []).map((l) => ({ ...l, href: safeUrl(l?.url) })).filter((l) => l.href)
  if (!liste.length) return null
  return (
    <Blok baslik="Katalog ve dokümanlar" baslikId="kart-dok">
      {liste.map((l, i) => {
        const u = new URL(l.href)
        const pdf = /\.pdf$/i.test(u.pathname)
        return (
          <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className={birlestir('flex items-center gap-3 min-h-[44px] rounded-xl text-metin hover:text-aksan', ODAK)}>
            <SimgeKutu ikon={FileText} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[14px] break-words">{l.title || u.hostname}</span>
              <span className="block text-xs text-metin-2">{[pdf ? 'PDF' : null, u.hostname.replace(/^www\./, '')].filter(Boolean).join(' · ')}</span>
            </span>
            {pdf ? <Download size={18} aria-hidden="true" className="text-metin-2 shrink-0" /> : <ExternalLink size={18} aria-hidden="true" className="text-metin-2 shrink-0" />}
          </a>
        )
      })}
    </Blok>
  )
}
