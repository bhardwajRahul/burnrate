import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CommandSearch } from '@/components/CommandSearch';
import { Button } from '@cred/neopop-web/lib/components';

const meta = {
  title: 'NeoPOP/CommandSearch',
  component: CommandSearch,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CommandSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

function CommandSearchWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" kind="elevated" size="medium" colorMode="dark" onClick={() => setOpen(true)}>
        Open Search (⌘K)
      </Button>
      <CommandSearch open={open} onClose={() => setOpen(false)} onSearch={(q, f) => console.log('Search:', q, f)} />
    </>
  );
}

export const Default: Story = {
  args: { open: false, onClose: () => {} },
  render: () => <CommandSearchWrapper />,
};
