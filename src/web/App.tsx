/** The route table and nothing else — see main.tsx for the provider stack that wraps this. */

import { Route, Routes } from 'react-router'

import { AddExpensePage } from './pages/AddExpensePage.js'
import { GroupDetailPage } from './pages/GroupDetailPage.js'
import { GroupsPage } from './pages/GroupsPage.js'
import { NotFoundPage } from './pages/NotFoundPage.js'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<GroupsPage />} />
      <Route path="/groups/:groupId" element={<GroupDetailPage />} />
      <Route path="/groups/:groupId/expenses/new" element={<AddExpensePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
