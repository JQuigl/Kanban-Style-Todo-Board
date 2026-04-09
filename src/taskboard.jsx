import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { supabase } from "./lib/client.ts";
import { CircleAlert, TimerIcon, Check } from "lucide-react";
const initialData = {
  todo: [],
  inProgress: [],
  inReview: [],
  done: []
};

const columnColors = {
  todo: "bg-orange-100",
  inProgress: "bg-blue-100",
  inReview: "bg-purple-100",
  done: "bg-green-100 border-green-300",
};

const priorityBorder = {
  low: "border-green-400",
  normal: "border-yellow-400",
  high: "border-red-400",
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState(initialData);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "normal",
    due_date: "",
  });
  const [draggedTask, setDraggedTask] = useState(null);
  const [user, setUser] = useState(null);
  
  const fetchTasks = async () => {
    const { data, error } = await supabase.from("Tasks").select("*");
    
    if (error) {
      console.error(error);
      return;
    }

    const grouped = {
      todo: [],
      inProgress: [],
      inReview: [],
      done: [],
    };

    data.forEach((task) => {
      grouped[task.status]?.push(task);
    });

    setColumns(grouped);
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        const { data } = await supabase.auth.signInAnonymously();
        setUser(data.user);
      } else {
        setUser(sessionData.session.user);
      }
    };

    initAuth();

    /*const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/login";
      }
    };

    checkUser();*/

    fetchTasks();
    const channel = supabase
      .channel("Tasks")
      // INSERT (new task added)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Tasks" },
        (payload) => {
          const task = payload.new;

          setColumns((prev) => ({
            ...prev,
            todo: [...prev.todo, task],
          }));
        }
      )

      // UPDATE (drag & drop changes status)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Tasks" },
        (payload) => {
          const updated = payload.new;

          setColumns((prev) => {
            const copy = { ...prev };

            // remove task from all columns
            Object.keys(copy).forEach((key) => {
              copy[key] = copy[key].filter((t) => t.id !== updated.id);
            });

            // add task to correct column
            const status = updated.status;
            copy[status] = [...(copy[status] || []), updated];

            return copy;
          });
        }
      )
      // DELETE
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "Tasks" },
        (payload) => {
          const deleted = payload.old;

          setColumns((prev) => {
            const copy = { ...prev };

            Object.keys(copy).forEach((key) => {
              copy[key] = copy[key].filter((t) => t.id !== deleted.id);
            });

            return copy;
          });
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleChange = (e) => {
    setNewTask({
      ...newTask,
      [e.target.name]: e.target.value,
    });
  };
  
  const addTask = async () => { 

    if (!newTask.title.trim()) return;
    if (!user) return;

    const task = {
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      status: "todo",
      user_id: user.id,
      is_guest_task: user.is_anonymous,
      created_by_authenticated_user: !user.is_anonymous,
      assignee_id: user.id, // default = creator (you can change later)
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
    .from("Tasks")
    .insert([task])
    .select("*");

    if (error) {
      console.error(error);
      return;
    }

    /*setColumns((prev) => ({ 
      ...prev, 
      todo: [...(prev.todo || []), data[0]],
    }));*/

    setNewTask({
      title: "",
      description: "",
      priority: "normal",
      due_date: "",
    });
  };

  const onDragStart = (task, fromColumn) => {
    setDraggedTask({ ...task, fromColumn });
  };

  const onDrop = async (toColumn) => {
    if (!draggedTask) return;

    const fromColumn = draggedTask.status;

    const { error } = await supabase
      .from("Tasks")
      .update({ status: toColumn })
      .eq("id", draggedTask.id);

    if (error) {
      console.error(error);
      return;
    }

    setColumns((prev) => {
      const updatedFrom = prev[fromColumn].filter(
        (t) => t.id !== draggedTask.id
      );

      const updatedTo = [
        ...(prev[toColumn] || []),
        { ...draggedTask, status: toColumn },
      ];

      return {
        ...prev,
        [fromColumn]: updatedFrom,
        [toColumn]: updatedTo,
      };
    });

    setDraggedTask(null);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    window.location.href = "/";
  };

  // STAT TRACKING \\
  const allTasks = [
    ...columns.todo,
    ...columns.inProgress,
    ...columns.inReview,
    ...columns.done,
  ];

  const totalTasks = allTasks.length;

  const completedTasks = columns.done.length;

  const overdueTasks = allTasks.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date) < new Date();
  }).length;

  // URGENCY TRACKER \\
  const getUrgency = (task) => {
    const { due_date: dueDate } = task.due_date ? task : { due_date: null };

    if (!dueDate) return "none";

    if(task.status === "done") return "normal";

    const today = new Date();
    const due = new Date(dueDate);

    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = (due - today) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return "overdue";
    if (diffDays <= 2) return "dueSoon";
    return "normal";
  };

  const renderColumn = (title, key) => (
  <div
    className="flex-1 bg-gray-100 rounded-2xl p-4 min-h-[400px]"
    onDragOver={(e) => e.preventDefault()}
    onDrop={() => onDrop(key)}
  >
    <h2 className="text-xl font-semibold mb-4">{title}</h2>

    <div className="space-y-3">
      {(columns[key] || []).map((task) => (
        <div
          key={task.id}
          draggable
          onDragStart={() => onDragStart(task, key)}
          className={`rounded-xl shadow p-3 cursor-grab border hover:scale-[1.2] transition border ${
  priorityBorder[task.priority]} ${
    columnColors[key]}`}
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">
              {task.title}
            </div>

            {/* URGENCY ICON */}
            <div className="text-sm">
              {getUrgency(task) === "overdue" && (
                <span title="Overdue">
                  <CircleAlert />
                </span>
              )}

              {getUrgency(task) === "dueSoon" && (
                <span title="Due soon">
                  <TimerIcon />
                </span>
              )}

              {getUrgency(task) === "normal" && task.due_date && (
                <span title="On track">
                  <Check />
                </span>
              )}
            </div>
          </div>

          {task.description && (
            <div className="text-xs text-gray-600 mt-1">
              {task.description}
            </div>
          )}

          <div className="flex justify-between text-xs mt-2">
            <span>
              {task.priority === "high" && "High"}
              {task.priority === "normal" && "Normal"}
              {task.priority === "low" && "Low"}
            </span>

            {task.due_date && (
              <span className="text-gray-500">
                📅 {task.due_date}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Task Board</h1>
      
      {user?.is_anonymous ? (
        <button
          onClick={() => (window.location.href = "/login")}
          className="absolute right-6 top-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Login
        </button>
      ) : (
        <button
          onClick={handleLogout}
          className="absolute right-6 top-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      )}

      <div className="grid gap-2 mb-6">
        <input
          name="title"
          value={newTask.title}
          onChange={handleChange}
          placeholder="Task title"
          className="border p-2 rounded"
        />

        <textarea
          name="description"
          value={newTask.description}
          onChange={handleChange}
          placeholder="Description (optional)"
          className="border p-2 rounded"
        />

        <div className="flex gap-2">
          <select
            name="priority"
            value={newTask.priority}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>

          <input
            type="date"
            name="due_date"
            value={newTask.due_date}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <button
            onClick={addTask}
            className="bg-black text-white px-4 rounded"
          >
            Add Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {renderColumn("To Do", "todo")}
        {renderColumn("In Progress", "inProgress")}
        {renderColumn("In Review", "inReview")}
        {renderColumn("Done", "done")}
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-300 shadow rounded-xl p-4 text-center">
          <h3 className="text-black-500 text-sm">Total Tasks</h3>
          <p className="text-2xl font-bold">{totalTasks}</p>
        </div>

        <div className="bg-green-300 shadow rounded-xl p-4 text-center">
          <h3 className="text-black-500 text-sm">Completed</h3>
          <p className="text-2xl font-bold text-black-600">
            {completedTasks}
          </p>
        </div>

        <div className="bg-red-300 shadow rounded-xl p-4 text-center">
          <h3 className="text-black-500 text-sm">Overdue</h3>
          <p className="text-2xl font-bold text-black-600">
            {overdueTasks}
          </p>
        </div>
      </div>

    </div>
  );
}
