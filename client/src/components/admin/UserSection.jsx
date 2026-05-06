import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { adminApi } from '../../api/apiService'
import moment from 'moment/min/moment-with-locales'
moment.locale('th')

export default function UserSection({ users, loading }) {
  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
        <h5 className="mb-0 fw-bold">
          <i className="bx bx-user me-2 text-primary"></i>
          จัดการผู้ใช้งาน
        </h5>
        <button className="btn btn-primary btn-sm" onClick={() => Swal.fire('Coming Soon', 'ระบบเพิ่มผู้ใช้งานกำลังพัฒนา', 'info')}>
          <i className="bx bx-plus me-1"></i> เพิ่มผู้ใช้งาน
        </button>
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-5">
            <span className="spinner-border text-primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>Username</th>
                  <th>สิทธิ์การใช้งาน</th>
                  <th>สถานะ</th>
                  <th>เข้าใช้งานล่าสุด</th>
                  <th style={{ width: 100 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      ไม่พบข้อมูลผู้ใช้งาน
                    </td>
                  </tr>
                )}
                {users.map((u, idx) => (
                  <tr key={u.a_id}>
                    <td>{idx + 1}</td>
                    <td className="fw-semibold">{u.a_name}</td>
                    <td>{u.a_username}</td>
                    <td>
                      <span className={`badge ${u.a_permiss === 'superadmin' ? 'bg-danger' : 'bg-primary'}`}>
                        {u.a_permiss === 'superadmin' ? 'SuperAdmin' : 'Admin'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.a_status === 'true' ? 'bg-success' : 'bg-secondary'}`}>
                        {u.a_status === 'true' ? 'ใช้งานปกติ' : 'ระงับการใช้งาน'}
                      </span>
                    </td>
                    <td className="small">
                      {u.a_last_login ? moment(u.a_last_login).locale('th').add(543, 'year').format('DD MMM YYYY HH:mm') : '-'}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-icon btn-outline-warning me-1" onClick={() => Swal.fire('Coming Soon', 'ระบบแก้ไขกำลังพัฒนา', 'info')}>
                        <i className="bx bx-edit"></i>
                      </button>
                      {u.a_permiss !== 'superadmin' && (
                        <button className="btn btn-sm btn-icon btn-outline-danger" onClick={() => Swal.fire('Coming Soon', 'ระบบลบกำลังพัฒนา', 'info')}>
                          <i className="bx bx-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
