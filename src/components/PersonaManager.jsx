import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Layers, Plus, Star, Pause, Play, RefreshCw, Trash2, Copy, Lock, Eye, EyeOff, Check, X, Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'
import { cardUrl, personaUrl } from '../lib/siteUrl'

// Profillerim — dijital kimliğin kişi tarafından yönetilen yüzleri.
//
// Her profil (persona) kendi alanlarını, kendi değerlerini (iş e-postası ≠
// kişisel e-posta) ve kendi paylaşım bağlantısını taşır. Gizli işaretlenen
// alan sunucudan HİÇ gönderilmez; bu ekran bir görsel filtre değildir.
//
// Ana profil /card/<kullanıcı-adı> ve basılı NFC/QR kartların gösterdiği
// profildir. Diğerleri tahmin edilemeyen /k/<kod> bağlantısıyla paylaşılır.
// Veri yazan her işlem sunucu fonksiyonundan geçer (doğrulama + denetim kaydı).

const KATEGORI = {
  iletisim: 'İletişim',
  kariyer: 'Kariyer',
  kisisel: 'Kişisel',
  ticari: 'Ticari',
}

const HATALAR = {
  limit_asildi: 'Planınızın profil sınırına ulaştınız.',
  ayni_ad_var: 'Bu isimde bir profiliniz zaten var.',
  ana_persona_silinemez: 'Ana profil silinemez. Önce başka bir profili ana profil yapın.',
  ana_persona_duraklatilamaz: 'Ana profil duraklatılamaz; basılı kartlarınız bu profili gösterir.',
  gecersiz_deger: 'Girdiğiniz değer geçerli değil.',
  gecersiz_ad: 'Profil adı 1–40 karakter olmalı.',
  gecersiz_tur: 'Geçersiz profil türü.',
  persona_bulunamadi: 'Profil bulunamadı; sayfayı yenileyin.',
}

const hataMesaji = (data, varsayilan) => {
  if (!data?.hata) return varsayilan
  if (data.hata === 'gecersiz_deger' && data.tur) {
    const tur = { email: 'e-posta', phone: 'telefon', url: 'bağlantı (https:// ile)', text: 'metin (en fazla 120 karakter)', longtext: 'metin (en fazla 2000 karakter)' }
    return `Geçerli bir ${tur[data.tur] || 'değer'} girin.`
  }
  return HATALAR[data.hata] || varsayilan
}

const degerMetni = (v) => {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.length ? `${v.length} öğe` : ''
  return String(v)
}

export default function PersonaManager({ username }) {
  const { showToast } = useToast()
  const [personas, setPersonas] = useState([])
  const [kinds, setKinds] = useState([])
  const [seciliId, setSeciliId] = useState(null)
  const [editor, setEditor] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  // Sınır ancak hata verince öğreniliyordu; kullanıcı kaç hakkı kaldığını
  // baştan görsün.
  const [planSinir, setPlanSinir] = useState(null)
  const [mesgul, setMesgul] = useState(null)
  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeni, setYeni] = useState({ kind: 'is', name: '', copyFrom: '' })
  const [duzenlenen, setDuzenlenen] = useState(null) // { key, value }

  const listeYukle = useCallback(async (secilecek) => {
    supabase.rpc('my_plan_limits').then(({ data: plan }) => {
      if (plan?.ok) setPlanSinir(plan.sinir.profil)
    })
    const { data, error } = await supabase.rpc('persona_list')
    if (error) { showToast('Profiller yüklenemedi', 'error'); return }
    setPersonas(data || [])
    const hedef = secilecek || seciliId || data?.[0]?.id
    if (hedef) setSeciliId(hedef)
  }, [seciliId, showToast])

  const editorYukle = useCallback(async (id) => {
    if (!id) return
    const { data, error } = await supabase.rpc('persona_editor', { p_persona_id: id })
    if (error || !data?.ok) { setEditor(null); return }
    setEditor(data)
  }, [])

  useEffect(() => {
    (async () => {
      setYukleniyor(true)
      const [{ data: turler }] = await Promise.all([
        supabase.from('persona_kinds').select('key, label, description').order('sort_order'),
      ])
      setKinds(turler || [])
      await listeYukle()
      setYukleniyor(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { editorYukle(seciliId) }, [seciliId, editorYukle])

  const secili = useMemo(() => personas.find(p => p.id === seciliId), [personas, seciliId])

  // Ana profil kullanıcı adı adresinde, diğerleri tahmin edilemeyen kodla.
  const paylasimUrl = (p) => (p?.is_primary ? cardUrl(username) : personaUrl(p?.share_code))

  const rpc = async (ad, params, basari, anahtar) => {
    setMesgul(anahtar || ad)
    try {
      const { data, error } = await supabase.rpc(ad, params)
      if (error) throw error
      if (data && data.ok === false) {
        showToast(hataMesaji(data, 'İşlem tamamlanamadı'), 'error')
        return null
      }
      if (basari) showToast(basari, 'success')
      return data || { ok: true }
    } catch (e) {
      console.error(ad, e)
      showToast('İşlem tamamlanamadı, tekrar deneyin', 'error')
      return null
    } finally {
      setMesgul(null)
    }
  }

  const yenile = async (id = seciliId) => { await listeYukle(id); await editorYukle(id) }

  // ---------------------------------------------------------------- profil işlemleri
  const olustur = async () => {
    const sonuc = await rpc('persona_create', {
      p_kind: yeni.kind,
      p_name: yeni.name.trim() || null,
      p_copy_from: yeni.copyFrom || null,
    }, 'Profil oluşturuldu', 'olustur')
    if (!sonuc) return
    setYeniAcik(false)
    setYeni({ kind: 'is', name: '', copyFrom: '' })
    await yenile(sonuc.id)
  }

  const guncelle = async (patch, basari) => {
    if (!secili) return
    const sonuc = await rpc('persona_update', { p_persona_id: secili.id, p_patch: patch }, basari, 'guncelle')
    if (sonuc) await yenile()
  }

  const anaYap = async () => {
    if (!secili) return
    if (!confirm(`"${secili.name}" ana profiliniz olacak.\n\nBasılı NFC/QR kartlarınız ve ${cardUrl(username)} adresiniz artık bu profili gösterecek. Devam edilsin mi?`)) return
    const sonuc = await rpc('persona_set_primary', { p_persona_id: secili.id }, 'Ana profil değiştirildi', 'ana')
    if (sonuc) await yenile()
  }

  const koduYenile = async () => {
    if (!secili) return
    if (!confirm('Bu profilin bağlantısı yenilenecek.\n\nDaha önce paylaştığınız bağlantı ve QR kod ÇALIŞMAYI DURDURACAK. Devam edilsin mi?')) return
    const sonuc = await rpc('persona_rotate_code', { p_persona_id: secili.id }, 'Yeni bağlantı oluşturuldu; eskisi artık çalışmıyor', 'kod')
    if (sonuc) await yenile()
  }

  const sil = async () => {
    if (!secili) return
    if (!confirm(`"${secili.name}" profili silinecek. Bu profilin bağlantısı ve QR kodu çalışmayı durduracak. Devam edilsin mi?`)) return
    const sonuc = await rpc('persona_delete', { p_persona_id: secili.id }, 'Profil silindi', 'sil')
    if (!sonuc) return
    setSeciliId(null)
    const { data } = await supabase.rpc('persona_list')
    setPersonas(data || [])
    setSeciliId(data?.[0]?.id || null)
  }

  const baglantiKopyala = async () => {
    if (!secili) return
    try {
      await navigator.clipboard.writeText(paylasimUrl(secili))
      showToast('Bağlantı kopyalandı', 'success')
    } catch {
      showToast('Kopyalanamadı — bağlantıyı elle seçin', 'warning')
    }
  }

  // ---------------------------------------------------------------- alan işlemleri
  const gorunurlukDegistir = async (alan) => {
    const yeniDeger = alan.visibility === 'public' ? 'private' : 'public'
    // İyimser güncelleme
    setEditor(prev => ({ ...prev, fields: prev.fields.map(f => f.key === alan.key ? { ...f, visibility: yeniDeger } : f) }))
    const sonuc = await rpc('persona_set_field', {
      p_persona_id: secili.id, p_field_key: alan.key, p_visibility: yeniDeger,
    }, null, `alan-${alan.key}`)
    if (!sonuc) await editorYukle(secili.id)
    else listeYukle()
  }

  const ozelDegerKaydet = async () => {
    if (!duzenlenen) return
    const deger = duzenlenen.value.trim()
    const sonuc = await rpc('persona_set_field', {
      p_persona_id: secili.id,
      p_field_key: duzenlenen.key,
      p_value: deger ? deger : null,
      p_clear_override: !deger,
    }, deger ? 'Bu profile özel değer kaydedildi' : 'Profil bilginiz kullanılacak', `deger-${duzenlenen.key}`)
    if (sonuc) { setDuzenlenen(null); await editorYukle(secili.id) }
  }

  const baglantiDegistir = async (link) => {
    setEditor(prev => ({ ...prev, social_links: prev.social_links.map(l => l.id === link.id ? { ...l, visible: !l.visible } : l) }))
    const sonuc = await rpc('persona_set_social_link', {
      p_persona_id: secili.id, p_social_link_id: link.id, p_visible: !link.visible,
    }, null, `link-${link.id}`)
    if (!sonuc) await editorYukle(secili.id)
    else listeYukle()
  }

  // ---------------------------------------------------------------- görünüm
  if (yukleniyor) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  const kategoriler = editor
    ? Object.entries(KATEGORI).map(([k, ad]) => ({ k, ad, alanlar: editor.fields.filter(f => f.category === k) }))
        .filter(g => g.alanlar.length)
    : []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Layers size={18} className="text-indigo-500" /> Profillerim
          {planSinir !== null && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              {personas.length}/{planSinir >= 999 ? '∞' : planSinir}
            </span>
          )}
        </h3>
        <button
          onClick={() => setYeniAcik(v => !v)}
          className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
        >
          <Plus size={14} /> Yeni profil
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        İş, bireysel ya da etkinlik için ayrı profiller oluşturun; her birinde neyi paylaşacağınızı siz seçin.
        Gizli bilgi, kartınızı açan kişiye <strong>hiç gönderilmez</strong>.
      </p>

      {/* Yeni profil */}
      {yeniAcik && (
        <div className="mb-5 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-300 mb-1">Profil türü</span>
              <select value={yeni.kind} onChange={e => setYeni({ ...yeni, kind: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {kinds.filter(k => k.key !== 'genel').map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-300 mb-1">Profil adı (isteğe bağlı)</span>
              <input value={yeni.name} maxLength={40} onChange={e => setYeni({ ...yeni, name: e.target.value })}
                placeholder={kinds.find(k => k.key === yeni.kind)?.label}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </label>
          </div>
          <label className="text-sm block">
            <span className="block text-gray-600 dark:text-gray-300 mb-1">Ayarları kopyala (isteğe bağlı)</span>
            <select value={yeni.copyFrom} onChange={e => setYeni({ ...yeni, copyFrom: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">Şablondan başla (hassas bilgiler kapalı gelir)</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.name} profilinden kopyala</option>)}
            </select>
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setYeniAcik(false)} className="px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Vazgeç</button>
            <button onClick={olustur} disabled={mesgul === 'olustur'} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">Oluştur</button>
          </div>
        </div>
      )}

      {/* Profil sekmeleri */}
      <div className="flex flex-wrap gap-2 mb-5">
        {personas.map(p => (
          <button key={p.id} onClick={() => { setDuzenlenen(null); setSeciliId(p.id) }}
            className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 border transition-colors ${
              p.id === seciliId
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
            }`}>
            {p.is_primary && <Star size={12} className={p.id === seciliId ? 'fill-white' : 'fill-amber-400 text-amber-400'} />}
            {p.name}
            {p.status === 'paused' && <Pause size={12} />}
          </button>
        ))}
      </div>

      {secili && editor && (
        <div className="space-y-5">
          {/* Başlık ve işlemler */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{secili.kind_label}</span>
              {secili.is_primary && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Ana profil · basılı kartlarınız bunu gösterir</span>}
              {secili.status === 'paused' && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">Duraklatıldı · bağlantı çalışmıyor</span>}
              <span className="text-gray-400 ml-auto">{secili.view_count} görüntülenme</span>
            </div>

            <div className="flex gap-2">
              <input readOnly value={paylasimUrl(secili)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              <button onClick={baglantiKopyala} title="Kopyala" className="px-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"><Copy size={16} /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              {!secili.is_primary && (
                <button onClick={anaYap} disabled={!!mesgul} className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1"><Star size={12} /> Ana profil yap</button>
              )}
              {!secili.is_primary && (
                secili.status === 'paused'
                  ? <button onClick={() => guncelle({ status: 'active' }, 'Profil yayında')} disabled={!!mesgul} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"><Play size={12} /> Yayına al</button>
                  : <button onClick={() => guncelle({ status: 'paused' }, 'Profil duraklatıldı')} disabled={!!mesgul} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"><Pause size={12} /> Duraklat</button>
              )}
              {!secili.is_primary && (
                <button onClick={koduYenile} disabled={!!mesgul} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"><RefreshCw size={12} /> Bağlantıyı yenile</button>
              )}
              {!secili.is_primary && (
                <button onClick={sil} disabled={!!mesgul} className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1 ml-auto"><Trash2 size={12} /> Sil</button>
              )}
            </div>

            <label className="block text-sm">
              <span className="block text-gray-600 dark:text-gray-300 mb-1">Bu profilde görünen ad</span>
              <input defaultValue={editor.persona?.display_name || ''} maxLength={80}
                key={`ad-${secili.id}`}
                placeholder={editor.profile_name || ''}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v !== (editor.persona?.display_name || '')) guncelle({ display_name: v }, 'Görünen ad kaydedildi')
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </label>
          </div>

          {/* Alanlar */}
          {kategoriler.map(grup => (
            <div key={grup.k}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{grup.ad}</h4>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                {grup.alanlar.map(alan => {
                  const acik = alan.visibility === 'public'
                  const ozel = alan.override_value !== null && alan.override_value !== undefined
                  const gecerli = ozel ? alan.override_value : alan.base_value
                  const duzenleniyor = duzenlenen?.key === alan.key
                  return (
                    <div key={alan.key} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {alan.label}
                            {alan.sensitive && <Lock size={12} className="text-gray-400" title="Hassas bilgi" />}
                            {ozel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">bu profile özel</span>}
                          </div>
                          {!duzenleniyor && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {degerMetni(gecerli) || <span className="italic">boş — kartta görünmez</span>}
                            </p>
                          )}
                        </div>
                        {alan.value_type !== 'list' && !duzenleniyor && (
                          <button onClick={() => setDuzenlenen({ key: alan.key, value: ozel ? String(alan.override_value) : '' })}
                            title="Bu profile özel değer" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Pencil size={14} />
                          </button>
                        )}
                        <button onClick={() => gorunurlukDegistir(alan)} disabled={mesgul === `alan-${alan.key}`}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg min-w-[88px] justify-center ${
                            acik ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                 : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {acik ? <><Eye size={12} /> Görünür</> : <><EyeOff size={12} /> Gizli</>}
                        </button>
                      </div>
                      {duzenleniyor && (
                        <div className="mt-2 flex gap-2">
                          <input autoFocus value={duzenlenen.value}
                            onChange={e => setDuzenlenen({ ...duzenlenen, value: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') ozelDegerKaydet(); if (e.key === 'Escape') setDuzenlenen(null) }}
                            placeholder={alan.has_base ? `Boş bırakılırsa profil bilginiz: ${degerMetni(alan.base_value) || '—'}` : 'Bu profilde görünecek değer'}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                          <button onClick={ozelDegerKaydet} className="px-2 rounded-lg bg-indigo-600 text-white"><Check size={14} /></button>
                          <button onClick={() => setDuzenlenen(null)} className="px-2 rounded-lg bg-gray-100 dark:bg-gray-700"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Bölümler */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Bölümler</h4>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
              {[
                { key: 'show_organizations', label: 'Organizasyon üyeliklerim' },
                { key: 'show_payment', label: 'Banka / fatura bilgilerim', hassas: true },
              ].map(b => (
                <div key={b.key} className="p-3 flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    {b.label} {b.hassas && <Lock size={12} className="text-gray-400" />}
                  </span>
                  <button onClick={() => guncelle({ [b.key]: !secili[b.key] })} disabled={mesgul === 'guncelle'}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg min-w-[88px] justify-center ${
                      secili[b.key] ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {secili[b.key] ? <><Eye size={12} /> Görünür</> : <><EyeOff size={12} /> Gizli</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sosyal bağlantılar */}
          {editor.social_links.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Sosyal bağlantılar</h4>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                {editor.social_links.map(link => (
                  <div key={link.id} className="p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{link.platform}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{link.url}</div>
                    </div>
                    <button onClick={() => baglantiDegistir(link)} disabled={mesgul === `link-${link.id}`}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg min-w-[88px] justify-center ${
                        link.visible ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                     : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {link.visible ? <><Eye size={12} /> Görünür</> : <><EyeOff size={12} /> Gizli</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
