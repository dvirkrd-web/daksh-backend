import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../../entities/address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

/** Customer addresses — every query is scoped to the owning user. */
@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addresses: Repository<Address>,
  ) {}

  list(userId: string): Promise<Address[]> {
    return this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async findOwned(userId: string, id: string): Promise<Address> {
    const address = await this.addresses.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found.');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addresses.count({ where: { userId } });
    const makeDefault = dto.is_default === true || count === 0;
    if (makeDefault) await this.clearDefaults(userId);
    return this.addresses.save(
      this.addresses.create({
        userId,
        fullName: dto.full_name,
        mobile: dto.mobile,
        houseNo: dto.house_no,
        street: dto.street,
        villageCity: dto.village_city,
        district: dto.district,
        state: dto.state,
        pinCode: dto.pin_code,
        isDefault: makeDefault,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOwned(userId, id);
    if (dto.is_default === true) {
      await this.clearDefaults(userId);
      address.isDefault = true;
    } else if (dto.is_default === false) {
      address.isDefault = false;
    }
    if (dto.full_name !== undefined) address.fullName = dto.full_name;
    if (dto.mobile !== undefined) address.mobile = dto.mobile;
    if (dto.house_no !== undefined) address.houseNo = dto.house_no;
    if (dto.street !== undefined) address.street = dto.street;
    if (dto.village_city !== undefined) address.villageCity = dto.village_city;
    if (dto.district !== undefined) address.district = dto.district;
    if (dto.state !== undefined) address.state = dto.state;
    if (dto.pin_code !== undefined) address.pinCode = dto.pin_code;
    return this.addresses.save(address);
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwned(userId, id);
    await this.addresses.remove(address);
  }

  private async clearDefaults(userId: string): Promise<void> {
    await this.addresses.update({ userId }, { isDefault: false });
  }
}
