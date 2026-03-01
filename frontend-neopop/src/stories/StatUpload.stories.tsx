import type { Meta, StoryObj } from '@storybook/react';
import { StatUpload } from '@/components/StatUpload';

const mockUpload = async (file: File) => {
  console.log('Uploading:', file.name);
  await new Promise((r) => setTimeout(r, 2000));
  return { status: 'success', count: 42, bank: 'hdfc' };
};

const mockPasswordUpload = async (_file: File, password?: string) => {
  await new Promise((r) => setTimeout(r, 1500));
  if (!password) return { status: 'error', message: 'Could not unlock PDF - wrong password' };
  return { status: 'success', count: 12, bank: 'icici' };
};

const meta = {
  title: 'NeoPOP/StatUpload',
  component: StatUpload,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onUpload: mockUpload },
};

export const Compact: Story = {
  args: { compact: true, onUpload: mockUpload },
};

export const PasswordProtected: Story = {
  args: { onUpload: mockPasswordUpload },
};

export const FullWidth: Story = {
  render: () => (
    <div style={{ width: 400 }}>
      <StatUpload onUpload={mockUpload} />
    </div>
  ),
};
