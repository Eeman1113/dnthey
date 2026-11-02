import { CreateClient } from './CreateClient';

export const metadata = { title: 'Create a character — dnthey' };

/** Thin RSC wrapper; all creation logic is a client island. */
export default function CreatePage() {
  return <CreateClient />;
}
