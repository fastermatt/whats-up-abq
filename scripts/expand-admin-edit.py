#!/usr/bin/env python3
"""Expand the AdminPanel edit modal with full place editing capabilities."""

with open('src/AdminPanel.tsx', 'r') as f:
    code = f.read()

count = 0

# ── 1. Add more state variables for edit fields ──────────────────────────────
old_state = "const [editPlace, setEditPlace] = useState<any|null>(null);\n  const [editPhotoUrl, setEditPhotoUrl] = useState('');\n  const [editSaving, setEditSaving] = useState(false);"

new_state = """const [editPlace, setEditPlace] = useState<any|null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editInsiderTip, setEditInsiderTip] = useState('');
  const [editBestFor, setEditBestFor] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRating, setEditRating] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPhone, setEditPhone] = useState('');"""

if old_state in code:
    code = code.replace(old_state, new_state)
    print("[1] Added edit field state variables")
    count += 1
else:
    print("[1] SKIP — state block not found")

# ── 2. Expand openEdit to populate all fields ────────────────────────────────
old_open = "const openEdit = (r: any) => { setEditPlace(r); setEditPhotoUrl(r.raw?.overridePhoto || ''); };"

new_open = """const openEdit = (r: any) => {
    setEditPlace(r);
    setEditPhotoUrl(r.raw?.overridePhoto || '');
    setEditName(r.raw?.name || '');
    setEditCategory(r.raw?.category || (r.raw?.types?.[0] || 'other'));
    setEditAddress(r.raw?.vicinity || r.raw?.address || r.raw?.formattedAddress || '');
    setEditDescription(r.raw?.description || r.raw?.about || '');
    setEditInsiderTip(r.raw?.insiderTip || r.enriched?.tip || '');
    setEditBestFor(r.raw?.bestFor || '');
    setEditTags((r.raw?.tags || []).join(', '));
    setEditRating(r.raw?.rating?.toString() || '');
    setEditWebsite(r.enriched?.website || r.raw?.website || '');
    setEditPhone(r.enriched?.phone || r.raw?.phone || '');
  };"""

if old_open in code:
    code = code.replace(old_open, new_open)
    print("[2] Expanded openEdit with all fields")
    count += 1
else:
    print("[2] SKIP — openEdit not found")

# ── 3. Expand saveEdit to save all fields ─────────────────────────────────────
old_save = """const saveEdit = async () => {
    if (!editPlace) return;
    setEditSaving(true);
    const updatedRaw = { ...editPlace.raw };
    if (editPhotoUrl.trim()) {
      updatedRaw.overridePhoto = editPhotoUrl.trim();
    } else {
      delete updatedRaw.overridePhoto;
    }
    const { error } = await sb('places').update({ raw: updatedRaw }).eq('id', editPlace.id);
    setEditSaving(false);
    if (error) { toast('Error: '+error.message, 'err'); return; }
    toast(editPhotoUrl.trim() ? 'Photo override saved ✓' : 'Override cleared ✓');
    setEditPlace(null);
    load();
  };"""

new_save = """const saveEdit = async () => {
    if (!editPlace) return;
    setEditSaving(true);
    const updatedRaw = { ...editPlace.raw };
    // Photo override
    if (editPhotoUrl.trim()) {
      updatedRaw.overridePhoto = editPhotoUrl.trim();
    } else {
      delete updatedRaw.overridePhoto;
    }
    // Core fields
    if (editName.trim()) updatedRaw.name = editName.trim();
    updatedRaw.category = editCategory || updatedRaw.category;
    if (editAddress.trim()) {
      updatedRaw.vicinity = editAddress.trim();
      updatedRaw.address = editAddress.trim();
      updatedRaw.formattedAddress = editAddress.trim();
    }
    // Description & tips
    if (editDescription.trim()) updatedRaw.description = editDescription.trim();
    else delete updatedRaw.description;
    if (editInsiderTip.trim()) updatedRaw.insiderTip = editInsiderTip.trim();
    else delete updatedRaw.insiderTip;
    if (editBestFor.trim()) updatedRaw.bestFor = editBestFor.trim();
    else delete updatedRaw.bestFor;
    // Tags
    const tagList = editTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (tagList.length > 0) updatedRaw.tags = tagList;
    else delete updatedRaw.tags;
    // Rating override
    const rVal = parseFloat(editRating);
    if (!isNaN(rVal) && rVal >= 0 && rVal <= 5) updatedRaw.rating = rVal;
    // Enriched data updates
    const updatedEnriched = { ...(editPlace.enriched || {}) };
    if (editWebsite.trim()) updatedEnriched.website = editWebsite.trim();
    if (editPhone.trim()) updatedEnriched.phone = editPhone.trim();
    if (editInsiderTip.trim()) updatedEnriched.tip = editInsiderTip.trim();

    const updatePayload: any = { raw: updatedRaw };
    if (Object.keys(updatedEnriched).length > 0) updatePayload.enriched = updatedEnriched;

    const { error } = await sb('places').update(updatePayload).eq('id', editPlace.id);
    setEditSaving(false);
    if (error) { toast('Error: '+error.message, 'err'); return; }
    toast('Place updated ✓');
    setEditPlace(null);
    load();
  };"""

if old_save in code:
    code = code.replace(old_save, new_save)
    print("[3] Expanded saveEdit with all fields")
    count += 1
else:
    print("[3] SKIP — saveEdit not found")

# ── 4. Expand edit modal UI ───────────────────────────────────────────────────
# Replace the section between the place name and enriched data section
old_modal_content = """<p style={{fontSize:14,fontWeight:700,color:'#374151',marginBottom:16}}>{editPlace.raw?.name}</p>

            {/* Enriched data section */}"""

new_modal_content = """<p style={{fontSize:14,fontWeight:700,color:'#374151',marginBottom:4}}>{editPlace.raw?.name}</p>
            <p style={{fontSize:11,color:'#9ca3af',marginBottom:16,fontFamily:'monospace'}}>{editPlace.id}</p>

            {/* Core fields */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Name</label>
                <input value={editName} onChange={e=>setEditName(e.target.value)} style={inp} placeholder="Place name" />
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={editCategory} onChange={e=>setEditCategory(e.target.value)} style={inp}>
                  {PLACE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Address</label>
                <input value={editAddress} onChange={e=>setEditAddress(e.target.value)} style={inp} placeholder="Full address" />
              </div>
              <div>
                <label style={lbl}>Rating (0–5)</label>
                <input value={editRating} onChange={e=>setEditRating(e.target.value)} style={inp} placeholder="4.5" type="number" min="0" max="5" step="0.1" />
              </div>
              <div>
                <label style={lbl}>Tags <span style={{fontWeight:400,color:'#9ca3af'}}>(comma-separated)</span></label>
                <input value={editTags} onChange={e=>setEditTags(e.target.value)} style={inp} placeholder="outdoor patio, dog friendly, live music" />
              </div>
            </div>

            {/* Description & tips */}
            <div style={{marginBottom:16}}>
              <label style={lbl}>Description / About</label>
              <textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} style={{...inp,minHeight:60,resize:'vertical'}} placeholder="A short description of this place…" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Insider Tip 💡</label>
                <textarea value={editInsiderTip} onChange={e=>setEditInsiderTip(e.target.value)} style={{...inp,minHeight:50,resize:'vertical'}} placeholder="Try the green chile burger…" />
              </div>
              <div>
                <label style={lbl}>Best For</label>
                <input value={editBestFor} onChange={e=>setEditBestFor(e.target.value)} style={inp} placeholder="Date night, brunch, families" />
              </div>
            </div>

            {/* Contact info */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Website</label>
                <input value={editWebsite} onChange={e=>setEditWebsite(e.target.value)} style={inp} placeholder="https://…" />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} style={inp} placeholder="(505) 555-1234" />
              </div>
            </div>

            {/* Enriched data section */}"""

if old_modal_content in code:
    code = code.replace(old_modal_content, new_modal_content)
    print("[4] Expanded edit modal UI with all fields")
    count += 1
else:
    print("[4] SKIP — modal content anchor not found")

# ── 5. Update save button label ───────────────────────────────────────────────
old_btn = """<button style={{...btnP,opacity:editSaving?0.7:1}} onClick={saveEdit} disabled={editSaving}>{editSaving?'Saving…':'Save Photo'}</button>"""
new_btn = """<button style={{...btnP,opacity:editSaving?0.7:1}} onClick={saveEdit} disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</button>"""

if old_btn in code:
    code = code.replace(old_btn, new_btn)
    print("[5] Updated save button label to 'Save Changes'")
    count += 1
else:
    print("[5] SKIP — save button not found")

with open('src/AdminPanel.tsx', 'w') as f:
    f.write(code)

print(f"\n✓ AdminPanel.tsx: {count} expansions applied")
