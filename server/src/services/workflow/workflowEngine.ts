import { OutFlowStrategy } from './strategies/outFlowStrategy.js';
// import { InFlowStrategy } from './strategies/inFlowStrategy.js';
// import { RejectStrategy } from './strategies/rejectStrategy.js';

export class WorkflowEngine {
  static async processAction(action: 'FORWARD_OUT' | 'FORWARD_IN' | 'REJECT', currentUser: any, docId: string) {
    let result;

    switch (action) {
      case 'FORWARD_OUT':
        result = await OutFlowStrategy.calculateNext(currentUser);
        break;
      // case 'FORWARD_IN':
      //   result = await InFlowStrategy.calculateNext(currentUser);
      //   break;
      // case 'REJECT':
      //   result = await RejectStrategy.calculateNext(currentUser, docId);
      //   break;
      default:
        throw new Error('Invalid Workflow Action');
    }

    return {
      success: true,
      predictedNextAssignee: result,
      inFlowState: action === 'FORWARD_OUT' ? 'out' : 'in'
    };
  }
}
