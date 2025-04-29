import { useAuthContext } from '~/hooks';
import { useGetUserProfile } from '~/hooks/Nav/useGetUserProfile';
import React from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import type { TDialogProps } from '~/common';
import { useLocalize } from '~/hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function MyProfile({ open, onOpenChange }: TDialogProps) {
  const localize = useLocalize();
  const { user, token, isAuthenticated } = useAuthContext();
  const { data: profile, isLoading: loading, error } = useGetUserProfile(open, token);

  React.useEffect(() => {}, [open]); // Remove fetch logic, keep effect for dependency

  return (
    <Transition appear show={open}>
      <Dialog as="div" className="relative z-50" onClose={onOpenChange}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black opacity-50 dark:opacity-80" aria-hidden="true" />
        </TransitionChild>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
            <DialogPanel className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <DialogTitle as="h2" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {localize('user_profile', 'User Profile')}
                </DialogTitle>
                <button
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  onClick={() => onOpenChange(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-5 w-5"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                  <span className="sr-only">{localize('close', 'Close')}</span>
                </button>
              </div>
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-4">
                  <button className="border-indigo-500 text-indigo-600 dark:text-indigo-400 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">{localize('usage_statistics', 'Usage Statistics')}</button>
                </nav>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* User Information */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">User Information</h3>
                    {loading ? (
                      <p className="text-gray-500">Loading...</p>
                    ) : error ? (
                      <p className="text-red-500">{error.message}</p>
                    ) : profile ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                          <p className="text-gray-900 dark:text-gray-100">{profile.user.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
                          <p className="text-gray-900 dark:text-gray-100">{profile.user.role}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Account Created</p>
                          <p className="text-gray-900 dark:text-gray-100">{new Date(profile.user.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Last Activity</p>
                          <p className="text-gray-900 dark:text-gray-100">{profile.user.lastActivity ? new Date(profile.user.lastActivity).toLocaleString() : '-'}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {/* 30-Day Usage Summary */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{localize('usage_summary_30d', '30-Day Usage Summary')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Conversations</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile?.usage?.conversations ?? '-'}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Messages</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile?.usage?.messages ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Daily Usage Table */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Daily Token Usage</h3>
                    <div className="h-64 flex flex-col items-center justify-center bg-white dark:bg-gray-700 rounded-lg overflow-y-auto">
                      {profile?.usage?.daily?.length ? (
                        <table className="min-w-full text-xs mb-6">
                          <thead>
                            <tr>
                              <th className="px-2 py-1 text-left">Date</th>
                              <th className="px-2 py-1 text-left">Input Tokens</th>
                              <th className="px-2 py-1 text-left">Output Tokens</th>
                              <th className="px-2 py-1 text-left">Total Tokens</th>
                              <th className="px-2 py-1 text-left">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profile.usage.daily.map((d: any) => (
                              <tr key={d.date}>
                                <td className="px-2 py-1 text-left">{d.date}</td>
                                <td className="px-2 py-1 text-left">{d.inputTokens}</td>
                                <td className="px-2 py-1 text-left">{d.outputTokens}</td>
                                <td className="px-2 py-1 text-left">{d.totalTokens}</td>
                                <td className="px-2 py-1 text-left">{d.totalCost?.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span className="text-gray-400">No daily usage data</span>
                      )}
                      {/* Cost per Day Line Graph */}
                      {profile?.usage?.daily?.length ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={profile.usage.daily} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={10} angle={-45} textAnchor="end" height={50} />
                            <YAxis dataKey="totalCost" fontSize={10} width={60} tickFormatter={(v) => `$${v.toFixed(2)}`}/>
                            <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} labelFormatter={label => `Date: ${label}`}/>
                            <Line type="monotone" dataKey="totalCost" stroke="#8884d8" strokeWidth={2} dot={false} name="Cost per Day" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : null}
                    </div>
                  </div>
                  {/* Usage by Model Table */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">{localize('usage_by_model', 'Usage by Model')}</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-left">Model</th>
                            <th className="px-2 py-1 text-left">Input Tokens</th>
                            <th className="px-2 py-1 text-left">Output Tokens</th>
                            <th className="px-2 py-1 text-left">Total Tokens</th>
                            <th className="px-2 py-1 text-left">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile?.usage?.byModel?.length > 0 ? (
                            profile.usage.byModel.map((row: any) => (
                              <tr key={row._id || 'unknown'}>
                                <td className="px-2 py-1">{row._id || '-'}</td>
                                <td className="px-2 py-1">{row.inputTokens ?? 0}</td>
                                <td className="px-2 py-1">{row.outputTokens ?? 0}</td>
                                <td className="px-2 py-1">{row.totalTokens ?? 0}</td>
                                <td className="px-2 py-1">{row.totalCost?.toFixed(4) ?? 0}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center text-gray-400 py-2">No usage data</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
