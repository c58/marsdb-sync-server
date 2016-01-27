import TodoModel from '../models/TodoModel';
import { publish } from 'marsdb-sync-server';


publish('allTodos', () =>
  TodoModel.find()
);
