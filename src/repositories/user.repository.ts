import { User } from '@prisma/client';
import { getPrismaClient } from '../integrations/prismaIntegration';
import { logger } from '../utils/logger';
import { normalizePersonName } from '../utils/normalization';

interface FindOrCreateUserInput {
  phoneNumber?: string;
  name?: string;
  fallbackName?: string;
}

const sanitize = (value: string): string => value.trim();

const defaultNameFromPhone = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '');
  const suffix = digits.slice(-4) || '0000';
  return `Payer ${suffix}`;
};

const isGenericName = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'user' ||
    normalized === 'sender' ||
    normalized === 'you' ||
    normalized === 'contact'
  );
};

export class UserRepository {
  private readonly prisma = getPrismaClient();

  public async findByPhone(phoneNumber: string): Promise<User | null> {
    const normalizedPhone = sanitize(phoneNumber);
    if (!normalizedPhone) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone }
    });
  }

  public async createRegisteredUser(phoneNumber: string, name: string): Promise<User> {
    const normalizedPhone = sanitize(phoneNumber);
    const normalizedName = normalizePersonName(name);

    if (!normalizedPhone || !normalizedName) {
      throw new Error('Invalid registration payload');
    }

    const existing = await this.findByPhone(normalizedPhone);
    if (existing) {
      return existing;
    }

    const created = await this.prisma.user.create({
      data: {
        phoneNumber: normalizedPhone,
        name: normalizedName
      }
    });

    logger.info({
      message: 'User created',
      userId: created.id,
      name: created.name,
      phoneNumber: created.phoneNumber
    });

    return created;
  }

  public async listAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  public async findByName(name: string): Promise<User | null> {
    const normalizedName = normalizePersonName(name);
    if (!normalizedName) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        }
      }
    });
  }

  public async createByName(name: string): Promise<User> {
    const normalizedName = normalizePersonName(name);
    if (!normalizedName) {
      throw new Error('Invalid participant name');
    }

    const existing = await this.findByName(normalizedName);
    if (existing) {
      return existing;
    }

    const created = await this.prisma.user.create({
      data: {
        name: normalizedName,
        phoneNumber: null
      }
    });

    logger.info({
      message: 'User created',
      userId: created.id,
      name: created.name,
      phoneNumber: created.phoneNumber
    });

    return created;
  }

  public async addAlias(userId: string, alias: string): Promise<User> {
    const normalizedAlias = normalizePersonName(alias);
    if (!normalizedAlias) {
      throw new Error('Invalid alias');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const aliasSet = new Set((user.aliases ?? []).map((item) => item.trim()).filter((item) => item.length > 0));
    aliasSet.add(normalizedAlias);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        aliases: Array.from(aliasSet)
      }
    });
  }

  public async findOrCreateUser(input: FindOrCreateUserInput): Promise<User> {
    const normalizedPhone = input.phoneNumber ? sanitize(input.phoneNumber) : '';
    const normalizedName = input.name ? normalizePersonName(input.name) : null;
    const normalizedFallback = input.fallbackName
      ? normalizePersonName(input.fallbackName)
      : null;

    if (normalizedPhone.length > 0) {
      const existingByPhone = await this.findByPhone(normalizedPhone);

      if (existingByPhone) {
        if (normalizedFallback && (existingByPhone.name.startsWith('Payer ') || isGenericName(existingByPhone.name))) {
          const updated = await this.prisma.user.update({
            where: { id: existingByPhone.id },
            data: { name: normalizedFallback }
          });

          return updated;
        }

        if (isGenericName(existingByPhone.name)) {
          const updated = await this.prisma.user.update({
            where: { id: existingByPhone.id },
            data: { name: defaultNameFromPhone(normalizedPhone) }
          });

          return updated;
        }

        return existingByPhone;
      }

      const created = await this.prisma.user.create({
        data: {
          phoneNumber: normalizedPhone,
          name: normalizedFallback ?? defaultNameFromPhone(normalizedPhone)
        }
      });

      logger.info({
        message: 'User created',
        userId: created.id,
        name: created.name,
        phoneNumber: created.phoneNumber
      });

      return created;
    }

    if (normalizedName) {
      return this.createByName(normalizedName);
    }

    throw new Error('findOrCreateUser requires phoneNumber or valid name');
  }
}
