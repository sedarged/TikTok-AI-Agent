import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject, duplicateProject } from '../api/client';
import type { Project } from '../api/types';
import { getErrorMessage } from '../utils/errors';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    getProjects({ page: currentPage, perPage }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setProjects(data.projects);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      })
      .catch((err) => {
        if (signal.aborted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [currentPage]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.values(menuRefs.current).forEach((ref) => {
        if (ref && !ref.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const refetchProjects = async () => {
    setLoading(true);
    try {
      const data = await getProjects({ page: currentPage, perPage });
      setProjects(data.projects);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      
      // If current page is now empty and not the first page, go to previous page
      if (data.projects.length === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await deleteProject(id);
      // Refetch to update counts and handle empty pages
      await refetchProjects();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateProject(id);
      // Refetch to update counts and show new project
      await refetchProjects();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT_PLAN: 'badge-info',
      PLAN_READY: 'badge-info',
      APPROVED: 'badge-warning',
      RENDERING: 'badge-warning',
      DONE: 'badge-success',
      FAILED: 'badge-error',
    };
    return styles[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
        <span className="sr-only">Loading projects</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link to="/create" className="btn btn-primary w-full sm:w-auto">
          + New Project
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">No projects yet</p>
          <Link to="/create" className="btn btn-primary w-full sm:w-auto">
            Create Your First Video
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div key={project.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <Link
                      to={`/project/${project.id}/plan`}
                      className="font-medium text-lg hover:text-green-400 truncate"
                    >
                      {project.title}
                    </Link>
                    <span className={`badge ${getStatusBadge(project.status)}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {project.nichePackId} | {project.targetLengthSec}s | {project.tempo}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Primary Action */}
                  {project.status === 'DONE' && project.runs && project.runs[0] ? (
                    <Link
                      to={`/run/${project.runs[0].id}`}
                      className="btn btn-primary text-sm w-full sm:w-auto"
                    >
                      View Output
                    </Link>
                  ) : (
                    <Link
                      to={`/project/${project.id}/plan`}
                      className="btn btn-primary text-sm w-full sm:w-auto"
                    >
                      Edit Plan
                    </Link>
                  )}

                  {/* More Menu */}
                  <div
                    className="relative"
                    ref={(el) => {
                      menuRefs.current[project.id] = el;
                    }}
                  >
                    <button
                      onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                      className="btn btn-secondary text-sm px-3"
                      aria-label="Open project actions"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === project.id}
                      aria-controls={`project-menu-${project.id}`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </button>

                    {openMenuId === project.id && (
                      <div
                        id={`project-menu-${project.id}`}
                        role="menu"
                        className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10 border"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <div className="py-1">
                          {(project.status === 'RENDERING' || project.status === 'FAILED') &&
                            project.runs &&
                            project.runs[0] && (
                              <Link
                                to={`/run/${project.runs[0].id}`}
                                role="menuitem"
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                                style={{ color: 'var(--color-text)' }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = 'var(--color-surface-2)')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = 'transparent')
                                }
                                onClick={() => setOpenMenuId(null)}
                              >
                                View Progress
                              </Link>
                            )}
                          {project.status === 'DONE' && project.runs && project.runs[0] && (
                            <Link
                              to={`/run/${project.runs[0].id}`}
                              role="menuitem"
                              className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                              style={{ color: 'var(--color-text)' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = 'var(--color-surface-2)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = 'transparent')
                              }
                              onClick={() => setOpenMenuId(null)}
                            >
                              View Output
                            </Link>
                          )}
                          <Link
                            to={`/project/${project.id}/plan`}
                            role="menuitem"
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-text)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = 'var(--color-surface-2)')
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            onClick={() => setOpenMenuId(null)}
                          >
                            Edit Plan
                          </Link>
                          <button
                            onClick={() => {
                              handleDuplicate(project.id);
                              setOpenMenuId(null);
                            }}
                            role="menuitem"
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-text)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = 'var(--color-surface-2)')
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(project.id);
                              setOpenMenuId(null);
                            }}
                            role="menuitem"
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-danger)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = 'var(--color-surface-2)')
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Showing {projects.length} of {total} projects
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary text-sm"
              style={{
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded text-sm ${
                      currentPage === page ? 'btn btn-primary' : 'btn btn-secondary'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary text-sm"
              style={{
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
