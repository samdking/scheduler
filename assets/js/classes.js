
	function Task(data)
	{
		var self = this;
		this.id = data.uid || 'NEW';
		this.user = ko.observable(data.user);
		this.ticket = data.ticket || {};
		this.description = data.description;
		this.estimatedTime = ko.observable(data.estimatedTime || 0);
		this.billedTime = ko.observable(data.billedTime || 0);
		this.date = new Date(data.date) || new Date();
		this.status = ko.observable(data.status || {});
		this.priority = ko.observable(isNaN(data.priority) && 50 || data.priority);
		this.overflow = ko.observable(false);
		this.timeTaken = ko.computed(function() {
			if (self.status().completed)
				return self.billedTime();
			else
				return Math.max(self.estimatedTime(), self.billedTime());
		});
		this.size = ko.computed(function() {
			return (self.timeTaken() * 40) + 'px';
		});
		this.label = ko.computed(function() {
			return '#' + this.id + ' ' + this.ticket.name + ' (' + this.timeTaken() + 'hrs)';// + '[' + this.priority() + ']';
		}, this);
	}

	function Ticket(data)
	{
		this.id = data.uid || null;
		this.summary = data.summary;
		this.name = data.name || '{' + this.id + '}';
		this.label = ko.computed(function() {
			var parts = [this.name, this.summary].filter(function(n) { return n; });
			return parts.join(' - ');
		}, this);
		this.status = ko.observable(data.status);
		this.project_status_uid = ko.observable(data.project_status_uid);
	}

	function User(data)
	{
		var self = this;
		this.name = data.name;
		this.lastInitial = data.lastInitial;
		this.tasks = ko.observableArray(data.tasks);
		this.active = ko.observable(true);
		this.label = ko.computed(function() {
			return self.active()? self.name : self.name.substr(0, 1) + self.lastInitial;
		});

		this.taskSorter = function(l, r) {
			if (l.status().completed && !r.status().completed)
				return -1;
			if (r.status().completed && !l.status().completed)
				return 1;
			if (l.priority() !== r.priority())
				return l.priority() > r.priority() ? -1 : 1;
			return 0;
		};

		this.tasksByDay = function(day) {
			var sum = 0;
			var tasks = this.tasks();
			var overflow = false;
			tasks = ko.utils.arrayFilter(tasks, function(task) {
				return day.isSameDay(task.date);
			});
			tasks.sort(self.taskSorter);
			return ko.utils.arrayFilter(tasks, function(task) {
				sum += task.timeTaken();
				overflow = sum > 8 && task.status().name == 'Pending';
				task.overflow(overflow);
				return true;
			});
		};

		this.toggleInactivity = function() {
			this.active(!this.active());
		};

		this.totalEstimatedTime = function(day) {
			var total = 0;
			var tasks = ko.utils.arrayFilter(this.tasks(), function(task) {
				return day.isSameDay(task.date);
			});
			ko.utils.arrayForEach(tasks, function(task) {
				total += task.timeTaken();
			});
			return total;
		};

		this.fitTask = function(task, day) {
			task.overflow(false);
			var overflow = this.totalEstimatedTime(day) - 8;
			task.estimatedTime(task.estimatedTime() - overflow);
		};

		/* Test */
		this.addTask = function() {
			this.tasks.push(new Task({priority: -1000000, date: '2013-07-02', billedTime: 2.5, status: Task.prototype.taskStatuses[1], ticket: new Ticket({name: 'TESTING', summary: 'Testing'})}));
		};
	}

	function Day(date)
	{
		var self = this;
		this.date = date;
		this.isSameDay = function(date) {
			return date.toISOString().substr(0, 10) == self.date.toISOString().substr(0, 10);
		};
	}

	function TaskStatus(data)
	{
		this.id = data.uid;
		this.name = data.name;
		this.completed = parseInt(data.completed, 10);
		this.slug = data.name.toLowerCase().replace(' ', '-');
	}

	function ProjectStatus(data)
	{
		this.id = data.uid;
		this.name = data.name;
		this.slug = data.name.toLowerCase().replace(' ', '-');
	}
