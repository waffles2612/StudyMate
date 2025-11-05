import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, Trash2, Plus, Calendar, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ToDo = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const response = await fetch(`${BACKEND_URL}/api/todos/${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const response = await fetch(`${BACKEND_URL}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          task: newTask,
        }),
      });

      if (response.ok) {
        setNewTask('');
        fetchTasks();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId, completed) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const response = await fetch(`${BACKEND_URL}/api/todos/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          completed: !completed,
        }),
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const response = await fetch(`${BACKEND_URL}/api/todos/${taskId}?userId=${user.uid}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
        <div className="text-2xl text-white font-semibold">Loading tasks... 📝</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 p-6">
      {/* Back Button - Top Right */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-end">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 bg-white/80 hover:bg-white text-purple-600 font-semibold px-6 py-3 rounded-full shadow-lg transition-all hover:shadow-xl"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent mb-8 flex items-center gap-3">
            <Calendar size={40} className="text-purple-600" /> 
            My To-Do List 📚
          </h1>

          {/* Add Task Section */}
          <div className="flex gap-3 mb-8">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a new task... ✨"
              className="flex-1 px-6 py-4 bg-pink-50 border-2 border-pink-200 rounded-2xl focus:outline-none focus:border-purple-400 focus:bg-white transition text-lg"
            />
            <button
              onClick={addTask}
              className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-8 py-4 rounded-2xl hover:from-pink-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
            >
              <Plus size={22} /> Add
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-4 mb-8">
            {tasks.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl">
                <p className="text-2xl text-gray-500 mb-2">🌟 No tasks yet!</p>
                <p className="text-gray-400">Add your first task to get started! 🚀</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all shadow-md hover:shadow-lg ${
                    task.completed
                      ? 'bg-gradient-to-r from-green-50 to-teal-50 border-green-300'
                      : 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-300'
                  }`}
                >
                  <button
                    onClick={() => toggleTask(task.id, task.completed)}
                    className={`transition-transform hover:scale-110 ${
                      task.completed ? 'text-green-500' : 'text-purple-500'
                    }`}
                  >
                    {task.completed ? (
                      <CheckCircle size={32} fill="currentColor" />
                    ) : (
                      <Circle size={32} />
                    )}
                  </button>

                  <span
                    className={`flex-1 text-lg font-medium ${
                      task.completed
                        ? 'line-through text-gray-500'
                        : 'text-gray-800'
                    }`}
                  >
                    {task.task}
                  </span>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-400 hover:text-red-600 transition-transform hover:scale-110"
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Stats Section */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-6 border-t-2 border-purple-100">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-4 text-center shadow-md">
                <p className="text-3xl font-bold text-purple-600">{tasks.length}</p>
                <p className="text-sm text-gray-600 font-semibold">Total Tasks</p>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl p-4 text-center shadow-md">
                <p className="text-3xl font-bold text-green-600">
                  {tasks.filter((t) => t.completed).length}
                </p>
                <p className="text-sm text-gray-600 font-semibold">✅ Completed</p>
              </div>
              <div className="bg-gradient-to-br from-pink-100 to-orange-100 rounded-2xl p-4 text-center shadow-md">
                <p className="text-3xl font-bold text-pink-600">
                  {tasks.filter((t) => !t.completed).length}
                </p>
                <p className="text-sm text-gray-600 font-semibold">⏳ Pending</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToDo;