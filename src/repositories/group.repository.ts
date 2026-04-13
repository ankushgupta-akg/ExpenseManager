import { Group, GroupMember, Prisma } from '@prisma/client';
import { getPrismaClient } from '../integrations/prismaIntegration';

const membershipWithUserArgs = {
  include: {
    user: true
  }
} satisfies Prisma.GroupMemberDefaultArgs;

export type GroupMemberWithUser = Prisma.GroupMemberGetPayload<typeof membershipWithUserArgs>;

export class GroupRepository {
  private readonly prisma = getPrismaClient();

  public async findPersonalGroupByUserId(userId: string): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: {
        name: 'Personal',
        members: {
          some: {
            userId
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  public async createGroup(name: string): Promise<Group> {
    return this.prisma.group.create({
      data: { name }
    });
  }

  public async addMember(groupId: string, userId: string): Promise<GroupMember> {
    return this.prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      },
      update: {},
      create: {
        groupId,
        userId
      }
    });
  }

  public async listMembers(groupId: string): Promise<GroupMemberWithUser[]> {
    return this.prisma.groupMember.findMany({
      where: { groupId },
      ...membershipWithUserArgs,
      orderBy: {
        createdAt: 'asc'
      }
    });
  }
}
