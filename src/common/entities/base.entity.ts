import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ example: 1, description: 'ID', uniqueItems: true })
  id: number;

  @ApiProperty({
    example: '2026-05-13T16:27:08.000Z',
    description: 'Created at',
  })
  @CreateDateColumn({ type: 'timestamptz' }) // Cambiado a timestamptz para coincidir con tu DBML
  createdAt: Date;

  @ApiProperty({
    example: '2026-05-13T16:27:08.000Z',
    description: 'Updated at',
  })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
