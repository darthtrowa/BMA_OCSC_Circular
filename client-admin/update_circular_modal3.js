import fs from 'fs';
const p = 'e:/BMA_OCSC_Circular/client-admin/src/components/admin/CircularModal.tsx';
let code = fs.readFileSync(p, 'utf-8');

// Update imports
code = code.replace(
  "import { adminApi, BASE_URL } from '../../api/apiService'",
  "import { adminApi, workflowApi, BASE_URL } from '../../api/apiService'"
);

// Update handleSave
const targetHandleSave = `      try {
        const data = isEdit
          ? await adminApi.updateCircular(fd)
          : await adminApi.createCircular(fd)
        if (data.status) {
          Swal.fire({ icon: 'success', text: data.message, timer: 1500, showConfirmButton: false })
          onSaved()
        } else {
          Swal.fire('ผิดพลาด', data.message, 'error')
        }
      } catch (err) {
        Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
      } finally {
        setSaving(false)
      }`;

const replacementHandleSave = `      try {
        const data = isEdit
          ? await adminApi.updateCircular(fd)
          : await adminApi.createCircular(fd)
        if (data.status) {
          if (mode === 'task-submit' && form.ag_id.length > 0 && isEdit) {
            const payload = form.ag_id.map((t: any) => ({
              ag_id: Number(t.value),
              ag_name: t.label
            }));
            await workflowApi.assignParallel(editItem.in_id, payload);
          }
          Swal.fire({ icon: 'success', text: data.message, timer: 1500, showConfirmButton: false })
          onSaved()
        } else {
          Swal.fire('ผิดพลาด', data.message, 'error')
        }
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
      } finally {
        setSaving(false)
      }`;

if (code.includes('adminApi.updateCircular(fd)')) {
  code = code.replace(targetHandleSave, replacementHandleSave);
  fs.writeFileSync(p, code, 'utf-8');
  console.log('Replaced successfully.');
} else {
  console.log('Target string not found.');
}
