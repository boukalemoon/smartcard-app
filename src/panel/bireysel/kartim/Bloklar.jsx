// Bloklar kartı: her satır bir bloğun ikonunu, özetini, görünürlüğünü,
// aç/kapa anahtarını ve aynı satırın içinde açılan düzenleme alanını taşır.
import { useState } from 'react'
import { Lock, Pencil, Plus, Trash2, ExternalLink, BadgeCheck, ArrowRight } from 'lucide-react'
import { Kart, Anahtar, Dugme, Girdi, Secim, Rozet } from '../../ui'
import { birlestir, tl } from '../../bicim'
import { GorunurlukSecici, Yakinda } from './parcalar'
import { SEVIYELER, alanDegeri, doluMu, ibanMaske, platformAdi, SOSYAL_PLATFORMLAR } from './yardim'

const IKON_TON = {
  aksan: 'bg-aksan-acik text-aksan-koyu dark:text-aksan',
  vurgu: 'bg-vurgu-acik text-vurgu',
  notr: 'bg-yuzey-2 text-metin-2',
}

function Lejant() {
  return (
    <div className="flex gap-x-2.5 gap-y-1 items-center flex-wrap text-xs text-metin-2">
      Görünürlük:
      {SEVIYELER.map((s) => (
        <span key={s.deger} className="inline-flex gap-1 items-center">
          <i className={birlestir('w-2 h-2 rounded-full inline-block', s.nokta)} aria-hidden="true" />{s.ad}
        </span>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ düzenleyiciler
function AlanDuzenleyici({ alanlar, islem, mesgul }) {
  return (
    <div className="flex flex-col divide-y divide-cizgi/70">
      {alanlar.map((f) => {
        const ozel = doluMu(f.override_value)
        const uzun = f.value_type === 'longtext'
        const ortak = {
          id: `alan-${f.key}`,
          key: `${f.key}-${ozel ? String(f.override_value) : ''}`,
          defaultValue: ozel ? String(f.override_value) : '',
          placeholder: f.has_base ? (doluMu(f.base_value) ? String(f.base_value) : 'Profilinizde boş') : 'Bu profilde görünecek değer',
          onBlur: (e) => {
            const v = e.target.value.trim()
            if (v === (ozel ? String(f.override_value) : '')) return
            islem.alanAyarla(f.key, { deger: v })
          },
        }
        return (
          <div key={f.key} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
            <label htmlFor={`alan-${f.key}`} className="sm:w-36 shrink-0 pt-0 sm:pt-2 text-[13px] font-semibold flex items-center gap-1.5 flex-wrap">
              {f.label}
              {f.sensitive && <Lock size={12} className="text-metin-2" aria-label="Hassas bilgi" />}
              {f.verified && <Rozet ton="olumlu" ikon={BadgeCheck} className="h-5 px-1.5 text-[10px]">doğrulandı</Rozet>}
            </label>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {f.value_type === 'list' ? (
                <span className="text-[13px] text-metin-2 pt-2">{(alanDegeri(f) || []).length} öğe · aşağıdan düzenleyin</span>
              ) : uzun ? (
                <textarea {...ortak} rows={3} maxLength={2000} className="w-full rounded-[10px] border border-cizgi bg-yuzey px-3 py-2 text-[14px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40" />
              ) : (
                <Girdi {...ortak} className="h-9 text-[14px]" maxLength={f.value_type === 'url' ? 500 : 254} />
              )}
              {f.has_base && f.value_type !== 'list' && (
                <span className="text-[11.5px] text-metin-2">{ozel ? 'Bu profile özel değer · silerseniz profil bilginiz kullanılır' : 'Boş bırakırsanız profil bilginiz kullanılır'}</span>
              )}
            </div>
            <GorunurlukSecici
              etiket={`${f.label} görünürlüğü`}
              deger={f.visibility || 'private'}
              disabled={mesgul}
              onChange={(v) => islem.alanAyarla(f.key, { gorunurluk: v })}
              className="sm:w-[170px]"
            />
          </div>
        )
      })}
    </div>
  )
}

function OdemeDuzenle({ blok, ctx, islem }) {
  const { profile } = ctx
  if (blok.anahtar === 'fatura') {
    const f = profile?.billing_info
    return (
      <div className="flex flex-col gap-3">
        {f ? (
          <div className="rounded-xl bg-yuzey-2 px-3.5 py-2.5 text-[13px] flex flex-col gap-0.5">
            <b>{f.company_title}</b>
            <span className="text-metin-2">{[f.tax_office, f.tax_number && `VKN/TCKN ${f.tax_number}`].filter(Boolean).join(' · ')}</span>
            {f.address && <span className="text-metin-2">{f.address}</span>}
          </div>
        ) : <p className="text-[13px] text-metin-2">Fatura bilgisi eklenmedi.</p>}
        <div className="flex gap-2 flex-wrap">
          <Dugme boyut="k" ikon={f ? Pencil : Plus} onClick={() => ctx.faturaDuzenle()}>{f ? 'Fatura bilgisini düzenle' : 'Fatura bilgisi ekle'}</Dugme>
        </div>
        <p className="text-xs text-metin-2">Fatura bilgisi tüm profillerinizde ortaktır; bu profilde görünüp görünmeyeceğini satırdaki anahtar belirler.</p>
      </div>
    )
  }
  const hesaplar = Array.isArray(profile?.bank_accounts) ? profile.bank_accounts : []
  return (
    <div className="flex flex-col gap-2">
      {hesaplar.map((h, i) => (
        <div key={`${h.iban}-${i}`} className="flex items-center gap-3 rounded-xl bg-yuzey-2 px-3.5 py-2">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{h.bank_name || 'Banka'}{h.account_holder ? ` · ${h.account_holder}` : ''}</div>
            <div className="text-xs text-metin-2 font-mono">{ibanMaske(h.iban)}</div>
          </div>
          <Dugme tur="sessiz" boyut="k" onClick={() => ctx.bankaDuzenle(h, i)}>Düzenle</Dugme>
          <button type="button" aria-label={`${h.bank_name || 'Hesabı'} sil`} onClick={() => islem.bankaSil(i)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-red-600 dark:hover:text-red-400 hover:bg-yuzey">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {!hesaplar.length && <p className="text-[13px] text-metin-2">Banka hesabı eklenmedi.</p>}
      <div><Dugme boyut="k" ikon={Plus} onClick={() => ctx.bankaDuzenle()}>Hesap ekle</Dugme></div>
      <p className="text-xs text-metin-2">IBAN değiştirmek iki adımlı doğrulama ister. Hesaplar tüm profillerinizde ortaktır; bu profilde görünmesini satırdaki anahtar belirler.</p>
    </div>
  )
}

function SosyalDuzenle({ editor, ctx, islem, sinir }) {
  const [yeni, setYeni] = useState({ platform: '', url: '' })
  const [duzenlenen, setDuzenlenen] = useState(null)
  const satirlar = editor.social_links || []
  const tam = (id) => (ctx.socialLinks || []).find((l) => l.id === id) || {}
  const doldu = sinir != null && satirlar.length >= sinir
  const bos = SOSYAL_PLATFORMLAR.filter(([id]) => !satirlar.some((l) => l.platform === id))

  return (
    <div className="flex flex-col gap-2">
      {satirlar.map((l) => {
        const t = tam(l.id)
        if (duzenlenen?.id === l.id) {
          return (
            <form
              key={l.id}
              className="flex flex-col sm:flex-row gap-2 rounded-xl bg-yuzey-2 p-2.5"
              onSubmit={async (e) => { e.preventDefault(); if (await islem.linkGuncelle(l.id, duzenlenen)) setDuzenlenen(null) }}
            >
              <Girdi aria-label={`${platformAdi(l.platform)} adresi`} value={duzenlenen.url} onChange={(e) => setDuzenlenen({ ...duzenlenen, url: e.target.value })} className="h-9 text-[14px] flex-1" />
              <Girdi aria-label="Başlık (isteğe bağlı)" placeholder={`Başlık · ${platformAdi(l.platform)}`} maxLength={60} value={duzenlenen.etiket} onChange={(e) => setDuzenlenen({ ...duzenlenen, etiket: e.target.value })} className="h-9 text-[14px] sm:w-44" />
              <div className="flex gap-1.5">
                <Dugme type="submit" tur="ana" boyut="k">Kaydet</Dugme>
                <Dugme tur="sessiz" boyut="k" onClick={() => setDuzenlenen(null)}>Vazgeç</Dugme>
              </div>
            </form>
          )
        }
        return (
          <div key={l.id} className="flex items-center gap-3 rounded-xl bg-yuzey-2 px-3.5 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">{t.etiket || platformAdi(l.platform)}{t.aktif === false && <Rozet className="h-5 text-[10px]">kartta gizli</Rozet>}</div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-aksan hover:underline truncate inline-flex items-center gap-1 max-w-full">
                <span className="truncate">{l.url}</span><ExternalLink size={11} aria-hidden="true" className="shrink-0" />
              </a>
            </div>
            <Anahtar acik={l.visible} etiket={`${platformAdi(l.platform)} bu profilde görünsün`} onChange={(v) => islem.linkGorunurluk(l, v)} />
            <button type="button" aria-label={`${platformAdi(l.platform)} düzenle`} onClick={() => setDuzenlenen({ id: l.id, url: l.url, etiket: t.etiket || '' })} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-metin hover:bg-yuzey">
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button type="button" aria-label={`${platformAdi(l.platform)} sil`} onClick={() => islem.linkSil(l)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-red-600 dark:hover:text-red-400 hover:bg-yuzey">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        )
      })}
      {doldu ? (
        <div className="rounded-xl border border-dashed border-cizgi px-3.5 py-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="text-metin-2">Planınızın sosyal bağlantı sınırına ({sinir}) ulaştınız.</span>
          <Dugme tur="vurgu" boyut="k" onClick={() => ctx.odemeyiAc()}>Planı yükselt</Dugme>
        </div>
      ) : (
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={async (e) => { e.preventDefault(); if (await islem.linkEkle(yeni)) setYeni({ platform: '', url: '' }) }}
        >
          <Secim etiket="Platform" value={yeni.platform} onChange={(v) => setYeni({ ...yeni, platform: v })} className="sm:w-44">
            <option value="">Platform seçin</option>
            {bos.map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}
          </Secim>
          <Girdi aria-label="Bağlantı adresi" placeholder="https://" value={yeni.url} onChange={(e) => setYeni({ ...yeni, url: e.target.value })} className="h-9 text-[14px] flex-1" />
          <Dugme type="submit" boyut="k" ikon={Plus} className="h-9" disabled={!yeni.platform || !yeni.url.trim()}>Ekle</Dugme>
        </form>
      )}
      <p className="text-xs text-metin-2">Bağlantılar tüm profillerinizde ortaktır; anahtar yalnız bu profilde görünüp görünmeyeceğini belirler.</p>
    </div>
  )
}

function ListeDuzenle({ blok, editor, ctx, islem }) {
  const anahtar = blok.anahtar === 'hizmet' ? 'services' : 'catalog_links'
  const f = editor.fields.find((x) => x.key === anahtar)
  const liste = Array.isArray(ctx.profile?.[anahtar]) ? ctx.profile[anahtar] : []
  const ozel = f && doluMu(f.override_value)
  const duzenle = (o, i) => (anahtar === 'services' ? ctx.hizmetDuzenle(o, i) : ctx.belgeDuzenle(o, i))
  return (
    <div className="flex flex-col gap-2">
      {ozel && <p className="text-xs text-vurgu">Bu profilde özel bir liste kayıtlı; aşağıdaki değişiklikler diğer profillerinizde görünür.</p>}
      {liste.map((o, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-yuzey-2 px-3.5 py-2">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{o.title || (anahtar === 'services' ? 'Hizmet' : 'Belge')}</div>
            <div className="text-xs text-metin-2 truncate">
              {anahtar === 'services'
                ? [Number(o.price) > 0 && tl(o.price), o.delivery_time, o.description].filter(Boolean).join(' · ') || 'Fiyat belirtilmedi'
                : o.url}
            </div>
          </div>
          <Dugme tur="sessiz" boyut="k" onClick={() => duzenle(o, i)}>Düzenle</Dugme>
          <button type="button" aria-label={`${o.title || 'Öğeyi'} sil`} onClick={() => islem.listedenSil(anahtar, i)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-red-600 dark:hover:text-red-400 hover:bg-yuzey">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {!liste.length && <p className="text-[13px] text-metin-2">{anahtar === 'services' ? 'Henüz hizmet eklenmedi.' : 'Henüz belge eklenmedi.'}</p>}
      <div><Dugme boyut="k" ikon={Plus} onClick={() => duzenle(null, null)}>{anahtar === 'services' ? 'Hizmet ekle' : 'Belge ekle'}</Dugme></div>
    </div>
  )
}

function GoogleDuzenle({ ctx, islem }) {
  const [url, setUrl] = useState(ctx.profile?.google_review_link || '')
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); islem.googleKaydet(url) }}>
      <label htmlFor="google-yorum" className="text-[13px] font-semibold">Google yorum bağlantısı</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Girdi id="google-yorum" type="url" placeholder="https://g.page/r/…/review" value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 text-[14px] flex-1" />
        <Dugme type="submit" tur="ana" boyut="k" className="h-9">Kaydet</Dugme>
      </div>
      <p className="text-xs text-metin-2">Google İşletme Profilinizdeki "Yorum iste" bağlantısını yapıştırın.</p>
    </form>
  )
}

// ------------------------------------------------------------------ satır
function BlokSatiri({ blok, acikMi, onDuzenle, editor, ctx, islem, mesgul, sosyalSinir, randevu }) {
  const Ikon = blok.ikon
  const alanlar = (blok.alanKeys || []).map((k) => editor.fields.find((f) => f.key === k)).filter(Boolean)
  const kapaliGorunum = !blok.acik && !blok.yakinda
  const anahtarKapali = mesgul || blok.yakinda || (blok.tur === 'randevu' && !randevu) || (!blok.icerikVar && !blok.acik && blok.tur !== 'alan')

  return (
    <div className={birlestir('rounded-xl border bg-yuzey transition-shadow', acikMi ? 'border-aksan ring-[3px] ring-aksan/15' : 'border-cizgi')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <div className={birlestir('flex items-center gap-3 flex-1 min-w-[200px]', kapaliGorunum && 'opacity-70')}>
          <span className={birlestir('w-9 h-9 rounded-[9px] inline-flex items-center justify-center shrink-0', IKON_TON[blok.ikonTon || (blok.yakinda ? 'notr' : 'aksan')])}>
            <Ikon size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold flex items-center gap-1.5">{blok.ad}{blok.yakinda && <Yakinda />}</div>
            <div className="text-xs text-metin-2 truncate">{blok.ozet}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <GorunurlukSecici
            etiket={`${blok.ad} görünürlüğü`}
            deger={blok.seviye}
            ikiSeviye={blok.ikiSeviye}
            disabled={mesgul || blok.yakinda || blok.sabitSeviye || (blok.tur !== 'alan' && !blok.icerikVar)}
            onChange={(v) => islem.seviyeAyarla(blok, v)}
            className="flex-1 sm:flex-none sm:w-[150px]"
          />
          <Anahtar acik={blok.acik} disabled={anahtarKapali} etiket={`${blok.ad} kartta görünsün`} onChange={(v) => islem.anahtarDegistir(blok, v)} />
          {blok.duzenleYok ? (
            <span className="w-[66px] shrink-0" aria-hidden="true" />
          ) : (
            <Dugme tur="sessiz" boyut="k" className="w-[66px] px-2" disabled={blok.yakinda} aria-expanded={acikMi} aria-label={`${blok.ad} ${acikMi ? 'düzenlemeyi kapat' : 'düzenle'}`} onClick={onDuzenle}>
              {acikMi ? 'Kapat' : 'Düzenle'}
            </Dugme>
          )}
        </div>
      </div>
      {acikMi && (
        <div className="border-t border-cizgi px-3.5 py-3">
          {blok.tur === 'alan' && blok.anahtar !== 'hizmet' && blok.anahtar !== 'belge' && blok.anahtar !== 'google' && (
            <AlanDuzenleyici alanlar={alanlar} islem={islem} mesgul={mesgul} />
          )}
          {(blok.anahtar === 'hizmet' || blok.anahtar === 'belge') && <ListeDuzenle blok={blok} editor={editor} ctx={ctx} islem={islem} />}
          {blok.anahtar === 'google' && <GoogleDuzenle key={ctx.profile?.google_review_link || ''} ctx={ctx} islem={islem} />}
          {blok.tur === 'odeme' && <OdemeDuzenle blok={blok} ctx={ctx} islem={islem} />}
          {blok.tur === 'sosyal' && <SosyalDuzenle editor={editor} ctx={ctx} islem={islem} sinir={sosyalSinir} />}
          {blok.tur === 'randevu' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-metin-2 max-w-md">Randevu süresi, çalışma saatleri ve onay biçimi Gelenler sayfasında ayarlanır. Randevu açıkken tüm profillerinizde görünür.</p>
              <Dugme boyut="k" sagIkon={ArrowRight} onClick={() => ctx.bolumDegistir('gelenler')}>Gelenler'de ayarla</Dugme>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Bloklar({ bloklar, acikBlok, setAcikBlok, editor, ctx, islem, mesgul, sosyalSinir, randevu, onBlokEkle }) {
  const acikSayisi = bloklar.filter((b) => b.acik).length
  return (
    <Kart className="p-5 flex flex-col gap-2.5" aria-labelledby="kartim-bloklar">
      <div className="flex justify-between items-center gap-2.5 flex-wrap">
        <h2 id="kartim-bloklar" className="font-baslik text-[15px] font-bold">
          Bloklar <span className="font-sans text-xs font-medium text-metin-2">{bloklar.length} blok · {acikSayisi} kartta açık</span>
        </h2>
        <Lejant />
      </div>
      {bloklar.map((b) => (
        <BlokSatiri
          key={b.anahtar}
          blok={b}
          acikMi={acikBlok === b.anahtar}
          onDuzenle={() => setAcikBlok(acikBlok === b.anahtar ? null : b.anahtar)}
          editor={editor}
          ctx={ctx}
          islem={islem}
          mesgul={mesgul}
          sosyalSinir={sosyalSinir}
          randevu={randevu}
        />
      ))}
      <Dugme tur="ikincil" ikon={Plus} className="h-11 border-dashed" onClick={onBlokEkle}>Blok ekle</Dugme>
    </Kart>
  )
}
