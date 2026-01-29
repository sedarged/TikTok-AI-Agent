import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject, duplicateProject } from '../api/client';
import type { Project } from '../api/types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    getProjects({ signal })
      .then((data) => {
        if (signal.aborted) return;
        setProjects(data);
      })
      .catch((err) => {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.values(menuRefs.current).forEach((ref) => {
        if (ref && !ref.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const newProject = await duplicateProject(id);
      setProjects([newProject, ...projects]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate project');
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
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
                  <div className="relative" ref={(el) => (menuRefs.current[project.id] = el)}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                      className="btn btn-secondary text-sm px-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {openMenuId === project.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10 border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="py-1">
                          {(project.status === 'RENDERING' || project.status === 'FAILED') && 
                           project.runs && project.runs[0] && (
                            <Link
                              to={`/run/${project.runs[0].id}`}
                              className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                              style={{ color: 'var(--color-text)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              onClick={() => setOpenMenuId(null)}
                            >
                              View Progress
                            </Link>
                          )}
                          {project.status === 'DONE' && project.runs && project.runs[0] && (
                            <Link
                              to={`/run/${project.runs[0].id}`}
                              className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                              style={{ color: 'var(--color-text)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              onClick={() => setOpenMenuId(null)}
                            >
                              View Output
                            </Link>
                          )}
                          <Link
                            to={`/project/${project.id}/plan`}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-text)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onClick={() => setOpenMenuId(null)}
                          >
                            Edit Plan
                          </Link>
                          <button
                            onClick={() => {
                              handleDuplicate(project.id);
                              setOpenMenuId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-text)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(project.id);
                              setOpenMenuId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                            style={{ color: 'var(--color-danger)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
    </div>
  );
}
