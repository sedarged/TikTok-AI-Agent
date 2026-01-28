import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject, duplicateProject } from '../api/client';
import type { Project } from '../api/types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProjects();
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
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link to="/create" className="btn btn-primary">
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
          <Link to="/create" className="btn btn-primary">
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
                  <p className="text-gray-400 text-sm">
                    {project.nichePackId} • {project.targetLengthSec}s • {project.tempo}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {project.status === 'DONE' && project.runs && project.runs[0] && (
                    <Link
                      to={`/run/${project.runs[0].id}`}
                      className="btn btn-primary text-sm"
                    >
                      View Output
                    </Link>
                  )}
                  
                  {(project.status === 'RENDERING' || project.status === 'FAILED') && 
                   project.runs && project.runs[0] && (
                    <Link
                      to={`/run/${project.runs[0].id}`}
                      className="btn btn-secondary text-sm"
                    >
                      View Progress
                    </Link>
                  )}

                  <Link
                    to={`/project/${project.id}/plan`}
                    className="btn btn-secondary text-sm"
                  >
                    Edit Plan
                  </Link>

                  <button
                    onClick={() => handleDuplicate(project.id)}
                    className="btn btn-secondary text-sm"
                  >
                    Duplicate
                  </button>

                  <button
                    onClick={() => handleDelete(project.id)}
                    className="btn btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
