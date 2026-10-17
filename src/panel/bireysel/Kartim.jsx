// KARTIM — blok tabanlı kart düzenleyici (tasarım: PanelKart).
//
// Sekmeler profillerdir (persona). Bloklar ayrı bir tablo değil, seçili
// profilin gerçek alanlarının/anahtarlarının görünümüdür: görünürlük alan
// bazında persona_set_field ile, bölüm anahtarları persona_update ile yazılır.
// Her değişiklik anında kaydedilir; bu yüzden "Yayınla" düğmesi yerine profilin
// yayın durumu (active/paused) yönetilir.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, IdCard, QrCode, Palette } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { cardUrl, personaUrl, SITE_URL } from '../../lib/siteUrl'
import { odemeBilgisiniYaz } from '../../lib/odemeBilgisi'
import { Kart, Dugme, Yukleniyor, BosDurum } from '../ui'
import { bloklariHesapla, hataMesaji, doluMu, alanDegeri } from './kartim/yardim'
import { ProfilSekmeleri, YayinDurumu } from './kartim/ProfilMenusu'
import UstBolum from './kartim/UstBolum'
import Bloklar from './kartim/Bloklar'
import BlokEkle from './kartim/BlokEkle'
import { CanliOnizlemeKarti, TelefonOnizleme } from './kartim/Onizleme'
import { RenkSecici } from './kartim/parcalar'

// "Kaydedildi · 2 dk önce" — saat, render sırasında okunmasın diye dışarıdan gelir.
function kacOnce(t, simdi) {
  if (!t) return ''
  const dk = Math.floor((simdi - new Date(t).getTime()) / 60000)
  if (dk < 1) return 'az önce'
  if (dk < 60) return `${dk} dk önce`
  const sa = Math.floor(dk / 60)
  if (sa < 24) return `${sa} sa önce`
  const gun = Math.floor(sa / 24)
  return gun === 1 ? 'dün' : `${gun} gün önce`
}

const URL_DUZELT = (u) => {
  const t = String(u || '').trim()
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function TemaPaneli({ renk, personaRengi, onSec, onKapat }) {
  const [yalnizBu, setYalnizBu] = useState(!!personaRengi)
  return (
    <Kart className="p-4 flex flex-col gap-3" aria-labelledby="kartim-tema">
      <div className="flex items-center justify-between">
        <h2 id="kartim-tema" className="font-baslik text-[15px] font-bold">Kart teması</h2>
        <Dugme tur="sessiz" boyut="k" onClick={onKapat}>Kapat</Dugme>
      </div>
      <RenkSecici deger={renk} onSec={(r) => onSec(r, yalnizBu)} />
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={yalnizBu} onChange={(e) => setYalnizBu(e.target.checked)} className="w-4 h-4 accent-aksan" />
        Yalnız bu profilde kullan
      </label>
      {personaRengi && (
        <button type="button" onClick={() => onSec(null, true)} className="self-start text-xs font-semibold text-aksan hover:underline">
          Bu profilin özel rengini kaldır
        </button>
      )}
    </Kart>
  )
}

export default function Kartim({ ctx }) {
  const { profile, setProfile, showToast } = ctx
  const [personas, setPersonas] = useState(null)
  const [kinds, setKinds] = useState([])
  const [randevu, setRandevu] = useState(null)
  const [seciliId, setSeciliId] = useState(null)
  const [editor, setEditor] = useState(null)
  const [editorSurum, setEditorSurum] = useState(0)
  const [yuklemeHatasi, setYuklemeHatasi] = useState(false)
  const [mesgul, setMesgul] = useState(false)
  const [kitle, setKitle] = useState('herkes')
  const [acikBlok, setAcikBlok] = useState(null)
  const [blokEkleAcik, setBlokEkleAcik] = useState(true)
  const [eklenenler, setEklenenler] = useState([])
  const [temaAcik, setTemaAcik] = useState(false)
  const [sonKayit, setSonKayit] = useState(null)
  const [simdi, setSimdi] = useState(() => Date.now())

  // ---------------------------------------------------------------- yükleme
  useEffect(() => {
    let iptal = false
    ;(async () => {
      const [liste, turler, ayar] = await Promise.all([
        supabase.rpc('persona_list'),
        supabase.from('persona_kinds').select('key, label, description').order('sort_order'),
        supabase.rpc('my_appointment_settings'),
      ])
      if (iptal) return
      if (liste.error) setYuklemeHatasi(true)
      setPersonas(Array.isArray(liste.data) ? liste.data : [])
      setKinds(turler.data || [])
      if (ayar.data?.ok) setRandevu(ayar.data)
    })()
    return () => { iptal = true }
  }, [])

  const aktifId = personas?.some((p) => p.id === seciliId) ? seciliId : personas?.[0]?.id || null
  const persona = personas?.find((p) => p.id === aktifId) || null

  useEffect(() => {
    if (!aktifId) return undefined
    let iptal = false
    supabase.rpc('persona_editor', { p_persona_id: aktifId }).then(({ data }) => {
      if (!iptal && data?.ok) setEditor(data)
    })
    return () => { iptal = true }
  }, [aktifId, editorSurum])

  useEffect(() => {
    const t = setInterval(() => setSimdi(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // persona_editor'ün temel değerleri yüklendiği andaki profilden gelir; profil
  // modallarla (hizmet, belge…) değişince önizleme bayat kalmasın diye güncel
  // profil üstüne bindirilir (temel kolon adları alan anahtarlarıyla aynı).
  const ed = useMemo(() => {
    if (!editor || editor.persona?.id !== aktifId) return null
    return {
      ...editor,
      fields: editor.fields.map((f) => (f.has_base && profile && f.key in profile ? { ...f, base_value: profile[f.key] } : f)),
    }
  }, [editor, aktifId, profile])

  const sosyalSinir = ctx.planBilgisi?.sinir?.sosyal_medya ?? null
  const bloklar = useMemo(
    () => bloklariHesapla({ editor: ed, profile, randevu, orgCount: ctx.orgCount || 0, sosyalSinir }),
    [ed, profile, randevu, ctx.orgCount, sosyalSinir],
  )
  const listedekiler = bloklar.filter((b) => b.cekirdek || b.icerikVar || b.acik || eklenenler.includes(b.anahtar))
  const eklenebilir = bloklar.filter((b) => !listedekiler.includes(b) && b.tur !== 'kurum')

  // ---------------------------------------------------------------- yazma
  const kaydedildi = () => { const t = Date.now(); setSonKayit(t); setSimdi(t) }
  const editoruYenile = () => setEditorSurum((s) => s + 1)
  const listeyiYenile = useCallback(async (secilecek) => {
    const { data } = await supabase.rpc('persona_list')
    if (Array.isArray(data)) setPersonas(data)
    if (secilecek) setSeciliId(secilecek)
  }, [])

  const calistir = async (ad, params, basari) => {
    setMesgul(true)
    try {
      const { data, error } = await supabase.rpc(ad, params)
      if (error) throw error
      if (data && data.ok === false) { showToast(hataMesaji(data), 'error'); return null }
      kaydedildi()
      if (basari) showToast(basari, 'success')
      return data || { ok: true }
    } catch (e) {
      console.error(ad, e)
      showToast('İşlem tamamlanamadı, tekrar deneyin', 'error')
      return null
    } finally {
      setMesgul(false)
    }
  }

  // İyimser güncelleme: anahtar/seçici beklemeden yer değiştirsin.
  const alanlariYerel = (degisim) => setEditor((e) => (e ? { ...e, fields: e.fields.map((f) => (degisim[f.key] ? { ...f, visibility: degisim[f.key] } : f)) } : e))

  const alanlarAyarla = async (anahtarlar, seviye) => {
    if (!persona || !anahtarlar.length) return true
    const degisim = Object.fromEntries(anahtarlar.map((k) => [k, seviye]))
    alanlariYerel(degisim)
    setMesgul(true)
    const sonuclar = await Promise.all(anahtarlar.map((k) => supabase.rpc('persona_set_field', { p_persona_id: persona.id, p_field_key: k, p_visibility: seviye })))
    setMesgul(false)
    const hata = sonuclar.find((r) => r.error || r.data?.ok === false)
    if (hata) {
      showToast(hata.error ? 'Görünürlük kaydedilemedi' : hataMesaji(hata.data), 'error')
      editoruYenile()
      return false
    }
    kaydedildi()
    listeyiYenile()
    return true
  }

  const alanAyarla = async (key, { gorunurluk, deger }) => {
    if (gorunurluk) return alanlarAyarla([key], gorunurluk)
    const sonuc = await calistir('persona_set_field', {
      p_persona_id: persona.id, p_field_key: key,
      ...(deger ? { p_value: deger } : { p_clear_override: true }),
    }, deger ? 'Bu profile özel değer kaydedildi' : 'Profil bilginiz kullanılacak')
    editoruYenile()
    return !!sonuc
  }

  const personaGuncelle = async (patch, basari) => {
    if (!persona) return false
    const sonuc = await calistir('persona_update', { p_persona_id: persona.id, p_patch: patch }, basari)
    if (sonuc) { await listeyiYenile(); editoruYenile() }
    return !!sonuc
  }

  const odemeAnahtari = async (alan, deger) => {
    const { data, error } = await supabase.from('profile_payment').update({ [alan]: deger }).eq('profile_id', profile.id).select('profile_id')
    if (error || !data?.length) { showToast('Ödeme görünürlüğü kaydedilemedi', 'error'); return false }
    setProfile((p) => ({ ...p, [alan]: deger }))
    kaydedildi()
    return true
  }

  // IBAN ve fatura bu profilde tek "ödeme" anahtarını (show_payment) paylaşır;
  // türlerin kendi anahtarları (show_bank_accounts / show_billing_info) ise
  // tüm profillerde ortaktır. Biri kapanırken diğeri açıksa yalnız kendi türü kapanır.
  const odemeAyarla = async (blok, acik) => {
    const x = ed.persona
    const diger = blok.odemeAlani === 'show_bank_accounts' ? 'show_billing_info' : 'show_bank_accounts'
    const digerVeri = diger === 'show_bank_accounts' ? (profile.bank_accounts || []).length > 0 : !!profile.billing_info
    const digerAcik = x.show_payment && profile[diger] && digerVeri
    if (acik) {
      if (!profile[blok.odemeAlani] && !(await odemeAnahtari(blok.odemeAlani, true))) return
      if (!x.show_payment) {
        await personaGuncelle({ show_payment: true })
        if (profile[diger] && digerVeri) showToast(`${diger === 'show_billing_info' ? 'Fatura bilgisi' : 'IBAN'} de bu profilde görünür (ortak ödeme anahtarı).`, 'info')
      }
    } else if (digerAcik) {
      if (await odemeAnahtari(blok.odemeAlani, false)) showToast(`${blok.ad} tüm profillerinizde gizlendi.`, 'info')
    } else {
      await personaGuncelle({ show_payment: false })
    }
  }

  const linkGorunurluk = async (link, gorunur) => {
    setEditor((e) => ({ ...e, social_links: e.social_links.map((l) => (l.id === link.id ? { ...l, visible: gorunur } : l)) }))
    const sonuc = await calistir('persona_set_social_link', { p_persona_id: persona.id, p_social_link_id: link.id, p_visible: gorunur })
    if (!sonuc) editoruYenile()
  }

  const sosyalYenile = async () => {
    const { data } = await supabase.from('social_links').select('*').eq('profile_id', profile.id).order('display_order')
    if (data) ctx.setSocialLinks(data)
    editoruYenile()
    ctx.planSinirlariniYukle?.()
  }

  const randevuAyarla = async (aktif) => {
    if (!randevu) return
    if (aktif && !Object.keys(randevu.gun_saatleri || {}).length) {
      showToast('Önce Gelenler sayfasından çalışma saatlerinizi girin.', 'warning')
      setAcikBlok('randevu')
      return
    }
    setRandevu((r) => ({ ...r, aktif }))
    const sonuc = await calistir('appointment_settings_save', {
      p_aktif: aktif, p_slot_dakika: randevu.slot_dakika, p_ileri_gun: randevu.ileri_gun,
      p_en_erken_saat: randevu.en_erken_saat, p_gun_saatleri: randevu.gun_saatleri || {},
      p_aciklama: randevu.aciklama || null, p_otomatik_onay: randevu.otomatik_onay,
    }, aktif ? 'Randevu kartınızda açıldı' : 'Randevu kapatıldı')
    if (!sonuc) setRandevu((r) => ({ ...r, aktif: !aktif }))
  }

  const blokAlanlari = (blok) => blok.alanKeys.map((k) => ed.fields.find((f) => f.key === k)).filter(Boolean)

  const islem = {
    alanAyarla,
    alanlarAyarla,
    personaGuncelle,
    seviyeAyarla: async (blok, seviye) => {
      if (seviye === 'karisik') return
      if (blok.tur === 'alan') return alanlarAyarla(blok.alanKeys, seviye)
      return islem.anahtarDegistir(blok, seviye !== 'private')
    },
    anahtarDegistir: async (blok, acik) => {
      if (blok.tur === 'alan') {
        if (!acik) return alanlarAyarla(blok.alanKeys, 'private')
        // Açarken hassas alanlar (e-posta, telefon, WhatsApp) kendiliğinden
        // açılmaz; kişi Düzenle'den tek tek açar.
        const alanlar = blokAlanlari(blok)
        const dolu = alanlar.filter((f) => doluMu(alanDegeri(f)))
        let acilacak = dolu.filter((f) => !f.sensitive)
        if (!acilacak.length) acilacak = dolu
        if (!acilacak.length) { acilacak = alanlar.filter((f) => !f.sensitive); setAcikBlok(blok.anahtar) }
        const ok = await alanlarAyarla(acilacak.map((f) => f.key), 'public')
        if (ok && dolu.some((f) => f.sensitive && !acilacak.includes(f))) showToast('Hassas alanlar gizli kaldı; Düzenle\'den tek tek açabilirsiniz.', 'info')
        return ok
      }
      if (blok.tur === 'odeme') return odemeAyarla(blok, acik)
      if (blok.tur === 'kurum') return personaGuncelle({ show_organizations: acik })
      if (blok.tur === 'randevu') return randevuAyarla(acik)
      if (blok.tur === 'sosyal') {
        const hedef = ed.social_links.filter((l) => l.visible !== acik)
        setEditor((e) => ({ ...e, social_links: e.social_links.map((l) => ({ ...l, visible: acik })) }))
        setMesgul(true)
        const r = await Promise.all(hedef.map((l) => supabase.rpc('persona_set_social_link', { p_persona_id: persona.id, p_social_link_id: l.id, p_visible: acik })))
        setMesgul(false)
        if (r.some((x) => x.error || x.data?.ok === false)) { showToast('Bağlantılar güncellenemedi', 'error'); editoruYenile() } else kaydedildi()
      }
    },
    linkGorunurluk,
    linkEkle: async ({ platform, url }) => {
      if (!platform || !url.trim()) return false
      setMesgul(true)
      try {
        const sira = (ctx.socialLinks || []).length
        const { data, error } = await supabase.from('social_links').insert({ profile_id: profile.id, platform, url: URL_DUZELT(url), display_order: sira }).select('id').single()
        if (error) throw error
        // Ana profile sunucu kendisi ekler; başka profildeysek burada da görünsün.
        if (!persona.is_primary && data?.id) await supabase.rpc('persona_set_social_link', { p_persona_id: persona.id, p_social_link_id: data.id, p_visible: true })
        kaydedildi()
        showToast('Bağlantı eklendi', 'success')
        await sosyalYenile()
        return true
      } catch (e) {
        showToast(/sinir|limit/i.test(e?.message || '') ? 'Planınızın sosyal bağlantı sınırına ulaştınız.' : 'Bağlantı eklenemedi: ' + (e?.message || ''), 'error')
        return false
      } finally {
        setMesgul(false)
      }
    },
    linkGuncelle: async (id, { url, etiket }) => {
      if (!url?.trim()) { showToast('Adres boş olamaz', 'error'); return false }
      const { data, error } = await supabase.from('social_links').update({ url: URL_DUZELT(url), etiket: etiket?.trim() || null }).eq('id', id).select('id')
      if (error || !data?.length) { showToast('Bağlantı güncellenemedi', 'error'); return false }
      kaydedildi()
      await sosyalYenile()
      return true
    },
    linkSil: (link) => ctx.onayIste({
      title: 'Bağlantı silinsin mi?',
      message: 'Bu bağlantı tüm profillerinizden kaldırılır.',
      onConfirm: async () => {
        const { data, error } = await supabase.from('social_links').delete().eq('id', link.id).select('id')
        if (error || !data?.length) { showToast('Bağlantı silinemedi', 'error'); return }
        kaydedildi()
        await sosyalYenile()
      },
    }),
    listedenSil: (alan, i) => ctx.onayIste({
      title: alan === 'services' ? 'Hizmet silinsin mi?' : 'Belge silinsin mi?',
      message: 'Tüm profillerinizden kaldırılır.',
      onConfirm: async () => {
        const yeni = (profile[alan] || []).filter((_, j) => j !== i)
        try {
          await ctx.profilAlaniKaydet({ [alan]: yeni })
          setProfile((p) => ({ ...p, [alan]: yeni }))
          kaydedildi()
        } catch (e) { showToast('Silinemedi: ' + e.message, 'error') }
      },
    }),
    bankaSil: (i) => ctx.onayIste({
      title: 'Banka hesabı silinsin mi?',
      message: 'Hesap tüm profillerinizden kaldırılır.',
      onConfirm: async () => {
        const yeni = (profile.bank_accounts || []).filter((_, j) => j !== i)
        const { error } = await odemeBilgisiniYaz(ctx.adimAtla, { profile_id: profile.id, bank_accounts: yeni, updated_at: new Date().toISOString() })
        if (error) { showToast(error.message || 'Silinemedi', 'error'); return }
        setProfile((p) => ({ ...p, bank_accounts: yeni }))
        kaydedildi()
      },
    }),
    googleKaydet: async (url) => {
      const t = url.trim()
      if (t && !/^https:\/\/\S+$/i.test(t)) { showToast('Bağlantı https:// ile başlamalı', 'error'); return }
      try {
        await ctx.profilAlaniKaydet({ google_review_link: t || null })
        setProfile((p) => ({ ...p, google_review_link: t || null }))
        kaydedildi()
        showToast(t ? 'Google yorum bağlantısı kaydedildi' : 'Bağlantı kaldırıldı', 'success')
      } catch (e) { showToast('Kaydedilemedi: ' + e.message, 'error') }
    },
    ustBilgiKaydet: async (d) => {
      try {
        await ctx.temelBilgileriKaydet({ name: d.name, title: d.title, company: d.company, phone: profile.phone || '', bio: profile.bio || '' })
        kaydedildi()
      } catch (e) { showToast(e.message, 'error'); return false }
      if (d.gorunen.trim() !== (ed.persona?.display_name || '')) await personaGuncelle({ display_name: d.gorunen.trim() })
      editoruYenile()
      showToast('Üst bölüm kaydedildi', 'success')
      return true
    },
    kapakKaydet: async (url) => {
      try {
        await ctx.profilAlaniKaydet({ background_image_url: url })
        setProfile((p) => ({ ...p, background_image_url: url }))
        kaydedildi()
      } catch (e) { showToast('Kapak kaydedilemedi: ' + e.message, 'error') }
    },
    temaKaydet: async (r, yalnizBuProfil = !!ed?.persona?.theme_color) => {
      if (yalnizBuProfil) return personaGuncelle({ theme_color: r || '' })
      try {
        await ctx.profilAlaniKaydet({ theme_color: r })
        ctx.setThemeColor(r)
        setProfile((p) => ({ ...p, theme_color: r }))
        kaydedildi()
      } catch (e) { showToast('Tema kaydedilemedi: ' + e.message, 'error') }
    },
    personaOlustur: async (params) => {
      const sonuc = await calistir('persona_create', params, 'Profil oluşturuldu')
      if (!sonuc) return false
      await listeyiYenile(sonuc.id)
      ctx.planSinirlariniYukle?.()
      return true
    },
    anaYap: async () => {
      const sonuc = await calistir('persona_set_primary', { p_persona_id: persona.id }, 'Ana profil değiştirildi')
      if (sonuc) { await listeyiYenile(); editoruYenile() }
    },
    koduYenile: async () => {
      const sonuc = await calistir('persona_rotate_code', { p_persona_id: persona.id }, 'Yeni bağlantı oluşturuldu; eskisi artık çalışmıyor')
      if (sonuc) await listeyiYenile()
    },
    personaSil: async () => {
      const sonuc = await calistir('persona_delete', { p_persona_id: persona.id }, 'Profil silindi')
      if (sonuc) { setSeciliId(null); await listeyiYenile(); ctx.planSinirlariniYukle?.() }
    },
  }

  // ---------------------------------------------------------------- görünüm
  if (!personas) return <Yukleniyor />
  if (!persona) {
    return (
      <Kart className="p-5">
        <BosDurum
          ikon={IdCard}
          baslik={yuklemeHatasi ? 'Profiller yüklenemedi' : 'Henüz profiliniz yok'}
          aciklama={yuklemeHatasi ? 'Bağlantınızı kontrol edip sayfayı yenileyin.' : 'Kartınızı düzenlemek için bir profil oluşturun.'}
          eylem={!yuklemeHatasi && <Dugme tur="ana" onClick={() => islem.personaOlustur({ p_kind: 'genel', p_name: null, p_copy_from: null })}>Profil oluştur</Dugme>}
        />
      </Kart>
    )
  }

  const adres = persona.is_primary ? cardUrl(profile?.username) : personaUrl(persona.share_code)
  const renk = ed?.persona?.theme_color || profile?.theme_color || ctx.themeColor || '#0A52B0'
  const kayitZamani = sonKayit || ed?.persona?.updated_at
  const plan = ctx.planBilgisi
  const planNotu = plan?.sinir
    ? `Planınızda ${personas.length}/${plan.sinir.profil >= 999 ? 'sınırsız' : plan.sinir.profil} profil ve ${plan.sinir.sosyal_medya >= 999 ? 'sınırsız' : `en fazla ${plan.sinir.sosyal_medya}`} sosyal bağlantı var.`
    : ''

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 flex-wrap min-w-0">
          <h1 className="font-baslik text-[26px] font-extrabold leading-tight">Kartım</h1>
          <ProfilSekmeleri
            personas={personas}
            aktifId={aktifId}
            onSec={(id) => { setSeciliId(id); setAcikBlok(null); setEklenenler([]) }}
            kinds={kinds}
            sinir={plan?.sinir?.profil ?? null}
            editor={ed}
            islem={islem}
            onYukselt={() => ctx.odemeyiAc()}
            cardAdres={`${SITE_URL.replace(/^https?:\/\/(www\.)?/, '')}/card/${profile?.username || ''}`}
          />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {kayitZamani && <span className="text-[13px] text-metin-2" role="status">Kaydedildi · {kacOnce(kayitZamani, simdi)}</span>}
          <Dugme as="a" href={adres} target="_blank" rel="noopener noreferrer" tur="ikincil" sagIkon={ExternalLink}>Önizle</Dugme>
          <YayinDurumu persona={persona} onDegistir={(s) => personaGuncelle({ status: s }, s === 'paused' ? 'Profil duraklatıldı' : 'Profil yayında')} />
        </div>
      </div>

      {!ed ? <Yukleniyor /> : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="flex flex-col gap-3.5 min-w-0">
            <UstBolum key={persona.id} ctx={ctx} editor={ed} islem={islem} renk={renk} />
            <Bloklar
              bloklar={listedekiler}
              acikBlok={acikBlok}
              setAcikBlok={setAcikBlok}
              editor={ed}
              ctx={ctx}
              islem={islem}
              mesgul={mesgul}
              sosyalSinir={sosyalSinir}
              randevu={randevu}
              onBlokEkle={() => {
                setBlokEkleAcik(true)
                requestAnimationFrame(() => document.getElementById('kartim-blok-ekle-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
              }}
            />
            {blokEkleAcik && (
              <BlokEkle
                eklenebilir={eklenebilir}
                plan={planNotu}
                onKapat={() => setBlokEkleAcik(false)}
                onEkle={(k) => { setEklenenler((l) => [...l, k]); setAcikBlok(k) }}
              />
            )}
          </div>

          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[84px]" aria-label="Canlı önizleme">
            <CanliOnizlemeKarti profile={profile} setProfile={setProfile} persona={persona} kitle={kitle} setKitle={setKitle} bildir={showToast} onKaydedildi={kaydedildi} />
            <TelefonOnizleme editor={ed} profile={profile} persona={persona} kitle={kitle} renk={renk} randevu={randevu} orgCount={ctx.orgCount || 0} vurgulanan={acikBlok} />
            <div className="flex gap-2">
              <Dugme tur="ikincil" ikon={QrCode} className="flex-1 h-9" onClick={() => ctx.bolumDegistir('paylasim')}>QR kodu</Dugme>
              <Dugme tur="ikincil" ikon={Palette} className="flex-1 h-9" aria-expanded={temaAcik} onClick={() => setTemaAcik((v) => !v)}>Kart teması</Dugme>
            </div>
            {temaAcik && (
              <TemaPaneli
                key={persona.id}
                renk={renk}
                personaRengi={ed.persona?.theme_color || null}
                onSec={(r, yalnizBu) => islem.temaKaydet(r, yalnizBu)}
                onKapat={() => setTemaAcik(false)}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
