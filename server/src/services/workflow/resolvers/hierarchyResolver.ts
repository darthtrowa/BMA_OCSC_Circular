import db from "../../../config/database.js";

export interface Agency {
  ag_id: number;
  ag_name: string;
  parent_ag_id: number | null;
  ag_type: string;
}

export class HierarchyResolver {
  // หาหน่วยงานที่เป็นหัวหน้าสายตรง (ขึ้นไป 1 ระดับ)
  static async getParentAgency(currentAgId: number): Promise<Agency | null> {
    const res = await db.query(
      "SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_id = $1",
      [currentAgId]
    );
    if (res.rows.length === 0 || !res.rows[0].parent_ag_id) return null;
    
    const parentRes = await db.query(
      "SELECT ag_id, ag_name, parent_ag_id, ag_type FROM c_agency WHERE ag_id = $1",
      [res.rows[0].parent_ag_id]
    );
    return (parentRes.rows[0] as Agency) || null;
  }

  // ตรวจสอบว่าในหน่วยงานนั้น มีตำแหน่งที่ระบุหรือไม่ (เช่น เช็กว่ามี SEC_DIRECTOR ไหม)
  static async hasRoleInAgency(agId: number, roleName: string): Promise<boolean> {
    const res = await db.query(
      `SELECT COUNT(*)::int as count 
       FROM admin a
       LEFT JOIN c_agency ag ON a.a_agency_id = ag.ag_id
       WHERE a.a_agency_id = $1 AND COALESCE(ag.ag_role, a.a_role) = $2`,
      [agId, roleName]
    );
    return res.rows[0].count > 0;
  }
}
