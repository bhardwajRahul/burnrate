import type { Meta, StoryObj } from '@storybook/react';
import { SetupForm } from '@/components/SetupForm';

const meta = {
  title: 'NeoPOP/SetupForm',
  component: SetupForm,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SetupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: (data) => console.log('Submitted:', data),
  },
};
