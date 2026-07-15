import { HierarchyResolver } from '../resolvers/hierarchyResolver.js';

export class OutFlowStrategy {
  static async calculateNext(currentUser: { a_agency_id: number, a_role: string, ag_type?: string, parent_ag_id?: number | null }) {
    const currentAgId = currentUser.a_agency_id;
    if (!currentAgId) {
      throw new Error('Current user has no agency');
    }

    const parentAg = await HierarchyResolver.getParentAgency(currentAgId);

    switch (currentUser.a_role) {
      case 'STAFF':
        return { nextRole: 'GRP_LEADER', nextAgId: parentAg?.ag_id || currentAgId };

      // COORDINATOR รายงานไปที่ HR_GRP_LEADER เสมอ (ไม่มี fallback)
      case 'COORDINATOR':
        return { nextRole: 'HR_GRP_LEADER', nextAgId: parentAg?.ag_id || currentAgId };

      case 'GRP_LEADER': {
        if (!parentAg) throw new Error('Parent agency not found');
        // 1. Check if parent agency has SEC_DIRECTOR (ผู้อำนวยการส่วน)
        const hasSecDirector = await HierarchyResolver.hasRoleInAgency(parentAg.ag_id, 'SEC_DIRECTOR');
        if (hasSecDirector) {
          return { nextRole: 'SEC_DIRECTOR', nextAgId: parentAg.ag_id };
        }

        // 2. Check if parent agency has HR_DIRECTOR
        const hasHrDirector = await HierarchyResolver.hasRoleInAgency(parentAg.ag_id, 'HR_DIRECTOR');
        if (hasHrDirector) {
          return { nextRole: 'HR_DIRECTOR', nextAgId: parentAg.ag_id };
        }

        // 3. Check if parent agency has DIV_DIRECTOR
        const hasDivDirector = await HierarchyResolver.hasRoleInAgency(parentAg.ag_id, 'DIV_DIRECTOR');
        if (hasDivDirector) {
          return { nextRole: 'DIV_DIRECTOR', nextAgId: parentAg.ag_id };
        }

        // 4. Move to grand parent agency
        const grandParentAg = await HierarchyResolver.getParentAgency(parentAg.ag_id);
        if (grandParentAg) {
          const grandHasHr = await HierarchyResolver.hasRoleInAgency(grandParentAg.ag_id, 'HR_DIRECTOR');
          if (grandHasHr) {
            return { nextRole: 'HR_DIRECTOR', nextAgId: grandParentAg.ag_id };
          }
          return { nextRole: 'DIV_DIRECTOR', nextAgId: grandParentAg.ag_id };
        }

        return { nextRole: 'DIV_DIRECTOR', nextAgId: parentAg.ag_id };
      }

      // HR_GRP_LEADER → HR_SEC_DIRECTOR (ถ้ามี) → HR_DIRECTOR
      case 'HR_GRP_LEADER': {
        if (!parentAg) throw new Error('Parent agency not found for HR_GRP_LEADER');
        const hasHrSecDirector = await HierarchyResolver.hasRoleInAgency(parentAg.ag_id, 'HR_SEC_DIRECTOR');
        if (hasHrSecDirector) {
          return { nextRole: 'HR_SEC_DIRECTOR', nextAgId: parentAg.ag_id };
        }
        // ข้ามไปหา HR_DIRECTOR โดยตรง (bypass HR_SEC_DIRECTOR)
        return { nextRole: 'HR_DIRECTOR', nextAgId: parentAg.ag_id };
      }

      // HR_SEC_DIRECTOR → HR_DIRECTOR เสมอ
      case 'HR_SEC_DIRECTOR': {
        if (!parentAg) return null;
        return { nextRole: 'HR_DIRECTOR', nextAgId: parentAg.ag_id };
      }

      case 'SEC_DIRECTOR': {
        if (!parentAg) return null;
        const hasHrDirector = await HierarchyResolver.hasRoleInAgency(parentAg.ag_id, 'HR_DIRECTOR');
        if (hasHrDirector) {
          return { nextRole: 'HR_DIRECTOR', nextAgId: parentAg.ag_id };
        }
        return { nextRole: 'DIV_DIRECTOR', nextAgId: parentAg.ag_id };
      }

      case 'DIV_DIRECTOR':
      case 'HR_DIRECTOR':
        // Top of the structural hierarchy in bottom-up flow
        return null;

      default:
        throw new Error(`Role ${currentUser.a_role} cannot perform Out-Flow`);
    }
  }
}
