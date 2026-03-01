import type { Meta, StoryObj } from '@storybook/react';
import { DateRangePicker } from '@/components/DateRangePicker';

const meta = {
  title: 'NeoPOP/DateRangePicker',
  component: DateRangePicker,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'this_month',
    onChange: (preset, range) => console.log('Changed:', preset, range),
  },
};

export const ThreeMonths: Story = {
  args: {
    value: '3_months',
    onChange: (preset) => console.log('Changed:', preset),
  },
};
