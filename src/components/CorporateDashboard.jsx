import OrganizationProfileManager from './OrganizationProfileManager'
import { exportToCSV, verifyPasswordForExport } from '../utils/exportHelpers'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import MemberManager from './MemberManager'
import ApplicationManager from './ApplicationManager'
import { Building2, Users, ChevronRight, MessageSquare, QrCode, Eye, Download, MousePointerClick, Share2, X } from 'lucide-react'
import AnalyticsFilter from './AnalyticsFilter'
import { filtreyiAraligaCevir } from '../utils/analyticsHelpers'

// KURUMSAL / STK PANELİ
//
// Bu panel 18.09.2026'da baştan bağlandı. Önceki hâlindeki sorunlar:
//   • Panel kişinin KENDİ planına bakıyordu (stk/business). Böyle bir abonesi
//     olmadığı için paneli kimse açamıyordu; bekleyen başvurular da
//     görülemiyordu. Artık ölçü yönetici olunan kurum.
//   • Dönem seçimi görseldi: seçilen filtre sunucuya hiç gitmiyordu.
//   • "QR Tarama" sütunu hep 0'dı; QR ile gelen ziyaretçi ayırt edilemiyordu.
//   • Her kurum için ayrı ayrı üye sorgusu atılıyordu (kurum sayısı kadar
//     istek). Artık tek çağrı: my_organizations().
//   • Kurum türü listesi arayüzde sabitti ve 'dernek' yazan kurumu tanımıyordu;
//     o kurumun başvuru ekranı hiç açılmıyordu. Artık sunucu karar veriyor.
//   • Üye e-postası sütunu her zaman boştu.

const BOS_TOPLAM = {
  profile_views: 0, qr_views: 0, nfc_views: 0, link_views: 0, direct_views: 0,
  vcard_downloads: 0, link_clicks: 0, shares: 0,
}

export default function CorporateDashboard({ profile }) {
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showMemberManager, setShowMemberManager] = useState(false)
  const [showApplications, setShowApplications] = useState(false)
  const [showOrgProfile, setShowOrgProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [analizKurumu, setAnalizKurumu] = useState(null)   // hangi kurumun raporu
  const [uyeAnalizi, setUyeAnalizi] = useState([])
  const [seri, setSeri] = useState([])
  const [toplam, setToplam] = useState(BOS_TOPLAM)
  const [aralik, setAralik] = useState({ from: null, to: null })
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false)
  const [detay, setDetay] = useState(null)

  const yoneticiKurumlar = organizations.filter(o => o.is_admin)

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true)
      // Tek çağrı: kurumlar, rolüm, üye sayısı, bekleyen başvuru, STK mı.
      const { data, error } = await supabase.rpc('my_organizations')
      if (error) throw error
      const liste = data || []
      setOrganizations(liste)
      setAnalizKurumu(onceki => onceki && liste.some(o => o.id === onceki)
        ? onceki
        : (liste.find(o => o.is_admin)?.id || null))
    } catch (error) {
      console.error('Organizasyonlar yüklenemedi:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrganizations() }, [loadOrganizations, profile?.id])

  const analiziYukle = useCallback(async (orgId, from, to) => {
    if (!orgId) { setUyeAnalizi([]); setSeri([]); setToplam(BOS_TOPLAM); return }
    try {
      setAnalizYukleniyor(true)
      const [{ data: uyeler, error: hata1 }, { data: gunler, error: hata2 }] = await Promise.all([
        supabase.rpc('org_member_analytics', { p_org_id: orgId, p_from: from, p_to: to }),
        supabase.rpc('org_activity_series', { p_org_id: orgId, p_from: from, p_to: to }),
      ])
      if (hata1) throw hata1
      if (hata2) throw hata2

      setUyeAnalizi(uyeler || [])
      setSeri(gunler || [])
      const t = { ...BOS_TOPLAM }
      for (const u of uyeler || []) {
        for (const k of Object.keys(BOS_TOPLAM)) t[k] += Number(u[k] || 0)
      }
      setToplam(t)
    } catch (error) {
      console.error('Analiz yüklenemedi:', error)
      setUyeAnalizi([]); setSeri([]); setToplam(BOS_TOPLAM)
    } finally {
      setAnalizYukleniyor(false)
    }
  }, [])

  useEffect(() => { analiziYukle(analizKurumu, aralik.from, aralik.to) }, [analizKurumu, aralik, analiziYukle])

  const uyeDetayiAc = async (uye) => {
    if (!uye.profile_id) {
      setDetay({ ok: false, hata: 'hesapsiz', ad: uye.name })
      return
    }
    const { data, error } = await supabase.rpc('org_member_detail', {
      p_org_id: analizKurumu, p_profile_id: uye.profile_id,
      p_from: aralik.from, p_to: aralik.to,
    })
    if (error) { console.error('Üye detayı alınamadı:', error); return }
    setDetay(data)
  }

  const handleExportMembers = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    try {
      const hepsi = []
      for (const org of yoneticiKurumlar) {
        // Üye bilgisi kişinin paylaşım tercihlerine göre süzülmüş gelir.
        const { data: members, error } = await supabase.rpc('org_member_list', { p_org_id: org.id })
        if (error) throw error
        hepsi.push(...(members || []).map(m => ({
          'Organizasyon': org.name,
          'Ad Soyad': m.name || '-',
          'E-posta': m.email || '-',
          'Telefon': m.phone || '-',
          'Rol': m.role,
          'Durum': m.status,
          'Katılım Tarihi': m.joined_at ? new Date(m.joined_at).toLocaleDateString('tr-TR') : '-',
        })))
      }
      if (hepsi.length === 0) { alert('Dışa aktarılacak üye yok.'); return }
      exportToCSV(hepsi, 'uyeler')
    } catch (error) {
      console.error('Dışa aktarma hatası:', error)
      alert('Dışa aktarılamadı: ' + error.message)
    }
  }

  const handleExportAnalytics = async () => {
    if (uyeAnalizi.length === 0) { alert('Bu dönemde dışa aktarılacak veri yok.'); return }
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    const kurum = organizations.find(o => o.id === analizKurumu)
    exportToCSV(uyeAnalizi.map(u => ({
      'Organizasyon': kurum?.name || '-',
      'Ad Soyad': u.name || '-',
      'Hesap': u.has_account ? 'Var' : 'Yok',
      'Katılım': u.joined_at ? new Date(u.joined_at).toLocaleDateString('tr-TR') : '-',
      'Görüntülenme': u.profile_views || 0,
      'QR ile': u.qr_views || 0,
      'NFC ile': u.nfc_views || 0,
      'Bağlantıyla': u.link_views || 0,
      'Doğrudan': u.direct_views || 0,
      'Rehbere Kaydetme': u.vcard_downloads || 0,
      'Bağlantı Tıklama': u.link_clicks || 0,
      'Paylaşım': u.shares || 0,
      'Toplam': u.total || 0,
      'Son Hareket': u.last_activity ? new Date(u.last_activity).toLocaleDateString('tr-TR') : '-',
    })), 'uye_performansi')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Panele erişim ölçüsü: bir kurumda yönetici olmak.
  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Henüz bir organizasyonunuz yok</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Bireysel panele geçip organizasyon oluşturabilir ya da bir organizasyona
          başvurabilirsiniz. Organizasyonun yöneticisi olduğunuzda üye takibi ve
          performans raporları burada görünür.
        </p>
      </div>
    )
  }

  const toplamUye = organizations.reduce((t, o) => t + (o.member_count || 0), 0)
  const bekleyenBasvuru = organizations.reduce((t, o) => t + Number(o.pending_applications || 0), 0)
  const enYuksekGun = Math.max(1, ...seri.map(g => Number(g.total || 0)))
  const seciliKurum = organizations.find(o => o.id === analizKurumu)

  return (
    <div className="space-y-6">

      {/* Özet kutuları */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-blue-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Organizasyon</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{organizations.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-green-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Toplam Üye</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{toplamUye}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-purple-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Yöneticisi Olduğum</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{yoneticiKurumlar.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-amber-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Bekleyen Başvuru</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{bekleyenBasvuru}</div>
        </div>
      </div>

      {yoneticiKurumlar.length > 0 && (
        <>
          {/* Dönem ve kurum seçimi */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Rapor:</label>
              <select
                value={analizKurumu || ''}
                onChange={(e) => setAnalizKurumu(e.target.value)}
                className="px-3 py-1.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"
              >
                {yoneticiKurumlar.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {aralik.from
                  ? `${new Date(aralik.from).toLocaleDateString('tr-TR')} – ${new Date(aralik.to).toLocaleDateString('tr-TR')}`
                  : 'Tüm zamanlar'}
              </span>
            </div>
            <AnalyticsFilter
              isPremium
              onFilterChange={(filter) => setAralik(filtreyiAraligaCevir(filter))}
              onExport={handleExportAnalytics}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Üyelikten önceki hareketler rapora girmez. QR ve NFC ayrımı, kod ve karta
              yazılan adresten gelir; bu işaretten önce basılmış kartlar "doğrudan" görünür.
            </p>
          </div>

          {/* Toplamlar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {seciliKurum?.name} — Dönem Özeti
            </h2>
            {/* Sınıf adları SABİT yazılır: Tailwind, `bg-${renk}-50` gibi
                çalışma anında üretilen adları derlemede bulamaz ve o renkleri
                dosyaya hiç koymaz — kutular renksiz çıkardı. */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { ikon: Eye, deger: toplam.profile_views, etiket: 'Görüntülenme',
                  kutu: 'bg-blue-50 dark:bg-blue-900/20', yazi: 'text-blue-700 dark:text-blue-300', alt: 'text-blue-600 dark:text-blue-400' },
                { ikon: QrCode, deger: toplam.qr_views + toplam.nfc_views, etiket: 'QR / NFC ile',
                  kutu: 'bg-green-50 dark:bg-green-900/20', yazi: 'text-green-700 dark:text-green-300', alt: 'text-green-600 dark:text-green-400' },
                { ikon: Download, deger: toplam.vcard_downloads, etiket: 'Rehbere Kaydetme',
                  kutu: 'bg-purple-50 dark:bg-purple-900/20', yazi: 'text-purple-700 dark:text-purple-300', alt: 'text-purple-600 dark:text-purple-400' },
                { ikon: MousePointerClick, deger: toplam.link_clicks, etiket: 'Bağlantı Tıklama',
                  kutu: 'bg-yellow-50 dark:bg-yellow-900/20', yazi: 'text-yellow-700 dark:text-yellow-300', alt: 'text-yellow-600 dark:text-yellow-400' },
                { ikon: Share2, deger: toplam.shares, etiket: 'Paylaşım',
                  kutu: 'bg-pink-50 dark:bg-pink-900/20', yazi: 'text-pink-700 dark:text-pink-300', alt: 'text-pink-600 dark:text-pink-400' },
              ].map(({ ikon: Ikon, deger, etiket, kutu, yazi, alt }) => (
                <div key={etiket} className={`p-4 ${kutu} rounded-lg text-center`}>
                  <Ikon className={`w-5 h-5 mx-auto mb-1 ${alt}`} />
                  <div className={`text-2xl font-bold ${yazi}`}>{deger}</div>
                  <div className={`text-xs ${alt} mt-1`}>{etiket}</div>
                </div>
              ))}
            </div>

            {/* Günlük hareket grafiği */}
            {seri.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Günlük hareket</div>
                <div className="flex items-end gap-0.5 h-24">
                  {seri.map(g => (
                    <div
                      key={g.gun}
                      title={`${new Date(g.gun).toLocaleDateString('tr-TR')}: ${g.total} hareket`}
                      className="flex-1 bg-blue-500/80 hover:bg-blue-600 rounded-t transition-all min-h-[2px]"
                      style={{ height: `${(Number(g.total || 0) / enYuksekGun) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{seri[0] && new Date(seri[0].gun).toLocaleDateString('tr-TR')}</span>
                  <span>{seri[seri.length - 1] && new Date(seri[seri.length - 1].gun).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Üye bazlı performans */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Üye Performansı</h2>
              <button
                onClick={handleExportAnalytics}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
              >
                CSV indir
              </button>
            </div>

            {analizYukleniyor ? (
              <div className="py-10 text-center text-gray-500 dark:text-gray-400">Yükleniyor…</div>
            ) : uyeAnalizi.length === 0 ? (
              <div className="py-10 text-center text-gray-500 dark:text-gray-400">Bu organizasyonda üye yok.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Üye</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Görüntülenme</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">QR / NFC</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Rehbere</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Tıklama</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Son Hareket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {uyeAnalizi.map((u) => (
                      <tr
                        key={u.member_id}
                        onClick={() => uyeDetayiAc(u)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{u.name?.charAt(0) || '?'}</span>
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{u.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {u.role === 'admin' ? 'Yönetici' : 'Üye'}
                                {!u.has_account && ' · hesabı yok'}
                                {u.status !== 'active' && ' · pasif'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">{u.profile_views || 0}</td>
                        <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">{(u.qr_views || 0) + (u.nfc_views || 0)}</td>
                        <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">{u.vcard_downloads || 0}</td>
                        <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">{u.link_clicks || 0}</td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                          {u.last_activity ? new Date(u.last_activity).toLocaleDateString('tr-TR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Ayrıntı için üyeye tıklayın.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Üye detayı */}
      {detay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setDetay(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {detay.uye?.ad || detay.ad || 'Üye'}
              </h3>
              <button onClick={() => setDetay(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {detay.hata === 'hesapsiz' ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bu üyenin QRtım hesabı yok; yalnızca listede kayıtlı. Hesap açıp
                organizasyona katıldığında hareketleri burada görünür.
              </p>
            ) : !detay.ok ? (
              <p className="text-sm text-red-600">Bilgi alınamadı.</p>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Katılım: {new Date(detay.uye.katilim).toLocaleDateString('tr-TR')} ·
                  Dönem: {new Date(detay.aralik.bas).toLocaleDateString('tr-TR')} – {new Date(detay.aralik.bit).toLocaleDateString('tr-TR')}
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Karta nereden geldiler</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(detay.kaynak || {}).length === 0 && (
                      <span className="text-sm text-gray-500">Bu dönemde hareket yok.</span>
                    )}
                    {Object.entries(detay.kaynak || {}).map(([k, v]) => (
                      <span key={k} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-200">
                        {({ qr: 'QR kod', nfc: 'NFC kart', link: 'Bağlantı', direct: 'Doğrudan', bilinmiyor: 'Bilinmiyor' })[k] || k}: <strong>{v}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {(detay.profiller || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Görüntülenen profiller</div>
                    {detay.profiller.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 text-gray-700 dark:text-gray-300">
                        <span>{p.ad}{p.ana ? ' (ana)' : ''}</span>
                        <strong>{p.goruntulenme}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {(detay.baglantilar || []).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">En çok tıklanan bağlantılar</div>
                    {detay.baglantilar.map((b, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 text-gray-700 dark:text-gray-300">
                        <span>{b.hedef}</span>
                        <strong>{b.tiklama}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dışa aktarma */}
      {yoneticiKurumlar.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportMembers}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
          >
            Üye listesini indir (CSV)
          </button>
        </div>
      )}

      {/* Kurum profili */}
      {showOrgProfile && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <OrganizationProfileManager
            organizationId={selectedOrg.id}
            onClose={() => { setShowOrgProfile(false); setSelectedOrg(null) }}
            onUpdate={() => loadOrganizations()}
          />
        </div>
      )}

      {/* Üye yönetimi */}
      {showMemberManager && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => { setShowMemberManager(false); setSelectedOrg(null) }}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              ← Organizasyonlara Dön
            </button>
          </div>
          <MemberManager
            organizationId={selectedOrg.id}
            onClose={() => { setShowMemberManager(false); setSelectedOrg(null); loadOrganizations() }}
          />
        </div>
      )}

      {/* Başvurular */}
      {showApplications && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => { setShowApplications(false); setSelectedOrg(null) }}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              ← Organizasyonlara Dön
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {selectedOrg.name} — Başvurular
          </h2>
          <ApplicationManager organizationId={selectedOrg.id} onChange={loadOrganizations} />
        </div>
      )}

      {/* Organizasyon listesi */}
      {!showMemberManager && !showApplications && !showOrgProfile && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Organizasyonlarım</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <div key={org.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{org.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {org.member_count} üye · {org.is_admin ? 'Yönetici' : 'Üye'}
                      {org.is_stk && ' · STK'}
                    </p>
                  </div>
                  <div className="ml-3">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>
                </div>

                {org.is_admin ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => { setSelectedOrg(org); setShowOrgProfile(true); setShowMemberManager(false); setShowApplications(false) }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
                    >
                      <div className="flex items-center gap-2"><Building2 className="w-4 h-4" /><span>Profil Yönet</span></div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedOrg(org); setShowMemberManager(true); setShowApplications(false) }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <div className="flex items-center gap-2"><Users className="w-4 h-4" /><span>Üyeleri Yönet</span></div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {/* STK kararı sunucudan gelir; arayüzdeki sabit tür listesi
                        'dernek' yazan kurumu tanımıyordu. */}
                    {org.is_stk && (
                      <button
                        onClick={() => { setSelectedOrg(org); setShowApplications(true); setShowMemberManager(false) }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <span>Başvurular</span>
                          {Number(org.pending_applications) > 0 && (
                            <span className="px-1.5 py-0.5 bg-white/25 rounded-full text-xs">{org.pending_applications}</span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bu organizasyonda üyesiniz. Yönetim işlemleri yöneticilerde.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
