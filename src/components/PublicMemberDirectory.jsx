import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, Mail, Phone, Search } from 'lucide-react'
import { Avatar, BosDurum } from '../panel/ui'
import { sayi } from '../panel/bicim'

export default function PublicMemberDirectory({ organizationId, organizationName }) {
  // Sonuç hangi kurum için alındıysa onunla saklanır; kurum değişince
  // "yükleniyor" kendiliğinden döner (effect içinde senkron set yok).
  const [sonuc, setSonuc] = useState({ kurum: null, members: [] })
  const [searchTerm, setSearchTerm] = useState('')
  const loading = sonuc.kurum !== organizationId
  const members = sonuc.members

  useEffect(() => {
    let iptal = false
    const loadMembers = async () => {
      try {
        // Eskiden members.select('*') her üyenin AD, E-POSTA ve TELEFONUNU
        // yayımlıyordu; kurumun memberVisibility/allowPublicDirectory tercihleri
        // hiç uygulanmıyordu (bulgu Y-2). Artık kurum tercihleri sunucuda
        // uygulanıyor ve iletişim bilgisi yalnızca kurum açıkça izin verirse
        // (settings.showMemberContact) dönüyor.
        const { data, error } = await supabase
          .rpc('get_public_org_members', { p_org_id: organizationId })

        if (error) throw error
        if (!iptal) setSonuc({ kurum: organizationId, members: data || [] })
      } catch (error) {
        console.error('Error loading members:', error)
        if (!iptal) setSonuc({ kurum: organizationId, members: [] })
      }
    }
    loadMembers()
    return () => { iptal = true }
  }, [organizationId])

  const filteredMembers = members.filter(member =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-8 h-8 rounded-full border-2 border-cizgi border-t-aksan animate-spin" role="status" aria-label="Üyeler yükleniyor" />
      </div>
    )
  }

  return (
    <section aria-labelledby="uyeler-baslik" className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 id="uyeler-baslik" className="font-baslik text-[24px] font-extrabold tracking-[-0.01em] text-metin">
            Üyeler
          </h2>
          <p className="mt-1 text-sm text-metin-2" aria-live="polite">
            {organizationName} · {sayi(filteredMembers.length)} aktif üye
          </p>
        </div>
        <div className="relative w-full sm:w-[320px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-metin-2 pointer-events-none" size={18} aria-hidden="true" />
          <label htmlFor="uye-ara" className="sr-only">Üye ara</label>
          <input
            id="uye-ara"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Üye ara..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-cizgi bg-yuzey text-[15px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan"
          />
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cizgi bg-yuzey">
          <BosDurum
            ikon={Users}
            baslik={searchTerm ? 'Üye bulunamadı' : 'Henüz üye yok'}
            aciklama={searchTerm ? 'Farklı bir arama terimi deneyin' : 'İlk üyelerin katılmasını bekleyin'}
            className="py-14"
          />
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <li key={member.id} className="rounded-2xl border border-cizgi bg-yuzey p-5 flex flex-col gap-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar ad={member.name || '?'} boyut={44} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-baslik text-[16px] font-bold text-metin truncate">
                    {member.name || 'İsimsiz Üye'}
                  </h3>
                  {member.role === 'admin' && (
                    <span className="mt-1 inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold bg-murekkep text-yuzey">
                      Yönetici
                    </span>
                  )}
                </div>
              </div>

              {(member.email || member.phone) && (
                <div className="flex flex-col gap-2 pt-4 border-t border-cizgi">
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-sm text-metin-2 hover:text-aksan min-w-0">
                      <Mail size={15} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{member.email}</span>
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-sm text-metin-2 hover:text-aksan">
                      <Phone size={15} className="shrink-0" aria-hidden="true" />
                      <span className="tabular-nums">{member.phone}</span>
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
