import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, BeforeUpdate, Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column('text', {
    unique: true,
  })
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
  })
  email!: string;

  @Column('text', {
    select: false,
  })
  password!: string;

  @Column('text')
  @ApiProperty({
    example: 'John Doe',
    description: 'User fullname',
  })
  fullname!: string;

  @Column('bool', {
    default: true,
  })
  @ApiProperty({
    example: true,
    description: 'User is active',
  })
  isActive!: boolean;

  @Column('text', {
    array: true,
    default: ['user'],
  })
  @ApiProperty({
    example: ['user'],
    description: 'User roles',
  })
  roles!: string[];

  @BeforeInsert()
  checkFieldsBeforeInsert(): void {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate(): void {
    this.checkFieldsBeforeInsert();
  }
}
