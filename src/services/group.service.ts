import { GroupRepository } from '../repositories/group.repository';

export interface GroupParticipant {
  userId: string;
  name: string;
  aliases: string[];
}

export class GroupService {
  constructor(private readonly groupRepository: GroupRepository) {}

  public async ensureDefaultGroup(userId: string): Promise<string> {
    const existing = await this.groupRepository.findPersonalGroupByUserId(userId);
    if (existing) {
      return existing.id;
    }

    const group = await this.groupRepository.createGroup('Personal');
    await this.groupRepository.addMember(group.id, userId);
    return group.id;
  }

  public async addMemberToGroup(groupId: string, userId: string): Promise<void> {
    await this.groupRepository.addMember(groupId, userId);
  }

  public async getMembers(groupId: string): Promise<GroupParticipant[]> {
    const members = await this.groupRepository.listMembers(groupId);

    return members.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      aliases: member.user.aliases ?? []
    }));
  }
}
