import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({
    example: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
    description: 'ID',
  })
  id!: string;

  @ApiProperty({
    example: '2026-05-13T16:27:08.000Z',
    description: 'Created at',
  })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-05-13T16:27:08.000Z',
    description: 'Updated at',
  })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
