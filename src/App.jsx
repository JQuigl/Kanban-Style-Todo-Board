import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const initialData = {
  toDo: [],
  inProgress: [],
  inReview: [],
  done: []
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState(initialData);
  const [newTask, setNewTask] = useState("");
  const [draggedTask, setDraggedTask] = useState(null);

  const addTask = () => {
    if (!newTask.trim()) return;
    const task = { id: Date.now(), text: newTask };
    setColumns({ ...columns, todo: [...columns.todo, task] });
    setNewTask("");
  };

  const onDragStart = (task, fromColumn) => {
    setDraggedTask({ ...task, fromColumn });
  };

  const onDrop = (toColumn) => {
    if (!draggedTask) return;

    const updatedFrom = columns[draggedTask.fromColumn].filter(
      (t) => t.id !== draggedTask.id
    );
    const updatedTo = [...columns[toColumn], draggedTask];

    setColumns({
      ...columns,
      [draggedTask.fromColumn]: updatedFrom,
      [toColumn]: updatedTo
    });

    setDraggedTask(null);
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
          className="bg-white rounded-xl shadow p-3 cursor-grab"
        >
          {task.text}
        </div>
      ))}
    </div>
  </div>
);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Kanban Task Board</h1>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Add a new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />
        <Button onClick={addTask}>Add</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderColumn("To Do", "todo")}
        {renderColumn("In Progress", "inProgress")}
        {renderColumn("In Review", "inReview")}
        {renderColumn("Done", "done")}
      </div>
    </div>
  );
}
