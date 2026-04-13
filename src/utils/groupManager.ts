import { GroupRepository } from '../repositories/group.repository';
import { GroupService } from '../services/group.service';

export class GroupManager extends GroupService {
  constructor() {
    super(new GroupRepository());
  }
}
