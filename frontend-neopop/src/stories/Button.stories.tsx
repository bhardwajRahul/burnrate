import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@cred/neopop-web/lib/components';
import { Upload, Plus } from 'lucide-react';

const meta = {
  title: 'NeoPOP/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] },
    kind: { control: 'select', options: ['elevated', 'flat', 'link'] },
    size: { control: 'select', options: ['big', 'medium', 'small'] },
    colorMode: { control: 'select', options: ['dark', 'light'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryElevated: Story = {
  args: {
    children: 'Save & Continue',
    variant: 'primary',
    kind: 'elevated',
    size: 'big',
    colorMode: 'dark',
    onClick: () => {},
  },
};

export const SecondaryFlat: Story = {
  args: {
    children: 'Cancel',
    variant: 'secondary',
    kind: 'flat',
    size: 'medium',
    colorMode: 'dark',
    onClick: () => {},
  },
};

export const PrimaryFlat: Story = {
  args: {
    children: 'Upload Statement',
    variant: 'primary',
    kind: 'flat',
    size: 'big',
    colorMode: 'dark',
    onClick: () => {},
  },
};

export const Small: Story = {
  args: {
    children: 'This Month',
    variant: 'secondary',
    kind: 'elevated',
    size: 'small',
    colorMode: 'dark',
    onClick: () => {},
  },
};

export const WithArrow: Story = {
  args: {
    children: 'Continue',
    variant: 'primary',
    kind: 'elevated',
    size: 'big',
    colorMode: 'dark',
    showArrow: true,
    onClick: () => {},
  },
};

export const Disabled: Story = {
  args: {
    children: 'Processing...',
    variant: 'primary',
    kind: 'elevated',
    size: 'big',
    colorMode: 'dark',
    disabled: true,
    onClick: () => {},
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" kind="elevated" size="big" colorMode="dark" onClick={() => {}}>
          Primary Elevated
        </Button>
        <Button variant="secondary" kind="elevated" size="big" colorMode="dark" onClick={() => {}}>
          Secondary Elevated
        </Button>
        <Button variant="primary" kind="flat" size="big" colorMode="dark" onClick={() => {}}>
          Primary Flat
        </Button>
        <Button variant="secondary" kind="flat" size="big" colorMode="dark" onClick={() => {}}>
          Secondary Flat
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" kind="elevated" size="small" colorMode="dark" onClick={() => {}}>
          Small
        </Button>
        <Button variant="primary" kind="elevated" size="medium" colorMode="dark" onClick={() => {}}>
          Medium
        </Button>
        <Button variant="primary" kind="elevated" size="big" colorMode="dark" onClick={() => {}}>
          Big
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" kind="elevated" size="medium" colorMode="dark" onClick={() => {}}>
          <Upload size={16} style={{ marginRight: 8 }} />
          Upload PDF
        </Button>
        <Button variant="secondary" kind="elevated" size="medium" colorMode="dark" onClick={() => {}}>
          <Plus size={16} style={{ marginRight: 8 }} />
          Add Card
        </Button>
      </div>
    </div>
  ),
};
