import { commandValue } from './service.ts';
import type { Command } from './core.ts';

export type CommandVariables = {
  containerID: string;
  sourceSlotID?: number | null;
  targetSlotID?: number;
};

export function mutationForCommand(value: Command): { name: Command['action']; variables: CommandVariables } {
  const command = commandValue(value);
  const variables: CommandVariables = { containerID: command.containerID };
  switch (command.action) {
    case 'AssignProductToSlot':
      variables.targetSlotID = command.targetSlotID!; break;

    case 'DispatchProduct':
      variables.sourceSlotID = command.sourceSlotID!; break;
    case 'ChangeAssignedSlot':
      variables.sourceSlotID = command.sourceSlotID!;
      variables.targetSlotID = command.targetSlotID!; break;
    case 'RecordExpiredScan':
      variables.sourceSlotID = command.sourceSlotID; break;
    default: {
      const impossible: never = command.action;
      throw new Error(`Unsupported location action: ${impossible}`);
    }
  }
  return { name: command.action, variables };
}

export function createCommandTransport(client: {
  mutate(name: Command['action'], variables: CommandVariables): Promise<unknown>;
}) {
  return {
    async executeCommand(command: Command): Promise<void> {
      const { name, variables } = mutationForCommand(command);
      await client.mutate(name, variables);
    },
  };
}
