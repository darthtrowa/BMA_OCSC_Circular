import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/CircularModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

const regex = /<div className="md:col-span-2 relative z-\[60\]">\s*<label className="block text-sm font-semibold text-slate-700 mb-1\.5">ผู้รับผิดชอบ <span className="text-rose-500">\*<\/span><\/label>\s*<Select isMulti placeholder="-- เลือกผู้รับผิดชอบ --"[\s\S]*?value=\{form\.ag_id\} onChange=\{v=>set\('ag_id',v\)\} \/>\s*<\/div>/;

const replacementStr = `              <div className="md:col-span-2 relative z-[60] p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 m-0">
                    ส่วนราชการที่รับมอบ
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                      {form.ag_id.length} ส่วนราชการ
                    </span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => set('ag_id', [...form.ag_id, { value: '', label: '', id: Date.now().toString() }])}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                  >
                    <i className="bx bx-plus"></i> เพิ่มส่วนราชการ
                  </button>
                </div>

                <div className="space-y-3">
                  {form.ag_id.length === 0 && (
                    <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm bg-white">
                      คลิกปุ่ม "เพิ่มส่วนราชการ" เพื่อเลือกส่วนราชการเป้าหมาย
                    </div>
                  )}
                  {form.ag_id.map((track: any, idx: number) => {
                    const trackId = track.id || idx.toString();
                    return (
                      <div key={trackId} className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            ส่วนราชการที่ {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => set('ag_id', form.ag_id.filter((_: any, i: number) => i !== idx))}
                            className="text-rose-400 hover:text-rose-600 transition text-sm flex items-center gap-1"
                            title="ลบส่วนราชการ"
                          >
                            <i className="bx bx-trash"></i>
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                            ส่วนราชการ <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={track.value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const ag = allData?.agency?.find((a: any) => String(a.ag_id) === val);
                              const newArr = [...form.ag_id];
                              newArr[idx] = { ...track, value: val, label: ag?.ag_name || '' };
                              set('ag_id', newArr);
                            }}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          >
                            <option value="">-- เลือกส่วนราชการ --</option>
                            {allData?.agency?.filter((a: any) => !a.parent_ag_id).map((ag: any) => (
                              <option key={ag.ag_id} value={String(ag.ag_id)}>
                                {ag.ag_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>`;

if (regex.test(code)) {
  code = code.replace(regex, replacementStr);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target regex not found.');
}
