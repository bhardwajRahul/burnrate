import type { Meta, StoryObj } from '@storybook/react';
import { CardWidget } from '@/components/CardWidget';

const meta = {
  title: 'NeoPOP/CardWidget',
  component: CardWidget,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CardWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HDFC: Story = {
  args: {
    bank: 'hdfc',
    last4: '4521',
    totalSpend: 124500,
    transactionCount: 23,
  },
};

export const ICICI: Story = {
  args: {
    bank: 'icici',
    last4: '7890',
    totalSpend: 89200,
    transactionCount: 15,
  },
};

export const Axis: Story = {
  args: {
    bank: 'axis',
    last4: '3344',
    totalSpend: 45600,
    transactionCount: 8,
  },
};

export const AllCards: Story = {
  args: { bank: 'hdfc', last4: '4521', totalSpend: 124500, transactionCount: 23 },
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <CardWidget bank="hdfc" last4="4521" totalSpend={124500} transactionCount={23} />
      <CardWidget bank="icici" last4="7890" totalSpend={89200} transactionCount={15} />
      <CardWidget bank="axis" last4="3344" totalSpend={45600} transactionCount={8} />
    </div>
  ),
};
