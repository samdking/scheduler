
	function Task(data)
	{
		var self = this;
		this.id = ko.observable();
		this.user = ko.observable();
		this.ticket = ko.observable();
		this.estimatedTime = ko.observable(0);
		this.billedTime = ko.observable(0);
		this.status = ko.observable({});
		this.priority = ko.observable();
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
			return '#' + this.id() + ' ' + (this.ticket()? this.ticket().name() : 'n/a') + ' (' + this.timeTaken() + 'hrs)';
		}, this);
		this.dbFields = function() {
			return {
				user_uid: self.user().id,
				project_uid: self.ticket.id,
				description: self.description,
				datetime: self.date.toISOString().substr(0, 10),
				task_status_uid: self.status().id,
				billedTime: self.billedTime() * 60,
				estimated_time: self.estimatedTime() * 60,
				priority: self.priority()
			};
		};
		this.populate = function(data) {
			this.id(data.uid || 'NEW');
			this.user(data.user);
			this.ticket(data.ticket);
			this.description = data.description;
			this.estimatedTime(data.estimated_time || 0);
			this.billedTime(data.billedTime || 0);
			this.date = new Date(data.date) || new Date();
			this.status(ko.utils.arrayFirst(Task.prototype.taskStatuses, function(status) {
				return status.id == data.task_status_uid;
			}) || {});
			this.priority(isNaN(data.priority) && 50 || data.priority);
		};
		this.populate(data);
	}

	function Ticket(data)
	{
		this.summary = ko.observable();
		this.name = ko.observable();
		this.status = ko.observable({});
		this.description = ko.observable();
		this.department_uid = ko.observable();
		this.allocatedTime = ko.observable();
		this.totalTime = ko.observable();
		this.label = ko.computed(function() {
			var parts = [this.name(), this.summary()].filter(function(n) { return n; });
			return parts.join(' - ');
		}, this);
		this.populate = function(data) {
			this.id = data.uid || null;
			this.summary(data.summary);
			this.name(data.name || '[' + this.id + ']');
			this.description(data.description);
			this.status(ko.utils.arrayFirst(Ticket.prototype.projectStatuses, function(status) {
				return status.id == data.project_status_uid;
			}));
			this.department_uid(parseInt(data.department_uid || 0, 10));
			this.allocatedTime(parseInt(data.allocated_time, 10));
			this.totalTime(parseInt(data.total_time, 10));
		};
		this.populate(data);
	}

	function Config(data)
	{
		var self = this;
		this.config = data? JSON.parse(data) : {};
		return {
			get: function(key) {
				return self.config[key];
			},
			set: function(key, value) {
				self.config[key] = value;
				localStorage.setItem('scheduler', JSON.stringify(self.config));
			}
		};
	}

	function User(data)
	{
		var self = this;
		this.id = data.id;
		this.name = data.name;
		this.lastInitial = data.lastInitial;
		this.tasks = ko.observableArray(data.tasks);
		this.active = ko.observable(data.active);
		this.active.subscribe(function(newVal) {
			var data = config.get('activeUsers') || {};
			data[self.id] = newVal;
			config.set('activeUsers', data);
		});
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
			tasks = ko.utils.arrayFilter(tasks, function(task) {
				return day.isSameDay(task.date);
			});
			tasks.sort(self.taskSorter);
			return ko.utils.arrayFilter(tasks, function(task) {
				sum += task.timeTaken();
				task.overflow(sum > 8 && task.status().name == 'Pending');
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
		this.completed = data.permanent;
		this.slug = data.name.toLowerCase().replace(' ', '-');
	}

	function ProjectStatus(data)
	{
		this.id = data.uid;
		this.name = data.name;
		this.slug = data.name.toLowerCase().replace(' ', '-');
		this.complete = Boolean(parseInt(data.complete, 10));
		this.sorting = parseInt(data.sorting, 10);
	}

	function Scheduler(days)
	{
		this.visibleDays = ko.observableArray(days);
		this.tickets = ko.observableArray([]);
		this.users = ko.observableArray([]);
		this.selectedTask = ko.observable();
		this.selectedTicket = ko.observable();
		this.activeTickets = ko.computed(function() {
			var tickets = ko.utils.arrayFilter(this.tickets(), function(ticket) {
				return ticket.status() && (ticket.status().complete === false) && ticket.department_uid() != 4;
			});
			tickets.sort(function(a, b) {
				a = a.status().sorting;
				b = b.status().sorting;
				if (a < b)
					return -1;
				if (b < a)
					return 1;
				return 0;
			});
			return tickets;
		}, this);
		
		this.newTicket = function() {
			this.tickets.push(new Ticket({
				uid: 'NEW', status: Ticket.prototype.projectStatuses[1], summary: 'New ticket - this would be populated by a lightbox prompt'
			}));
		};
		
		this.save = function(obj, callback) {
			if (obj.id() === 'NEW') {
				console.log('creating new task');
				$.ajax({
					url: '/api/tasks',
					method: 'POST',
					dataType: 'JSON',
					data: obj.dbFields()
				}).done(function(newObj) {
					if (callback)
						callback(newObj.task);
					obj.id(newObj.task.uid);
				});
			} else {
				$.ajax({
					url: '/api/tasks/' + obj.id(),
					method: 'PUT',
					dataType: 'JSON',
					data: obj.dbFields()
				}).done(function(newObj) {
					if (callback)
						callback(newObj);
				});
				console.log('updating task #' + obj.id());
			}
		};
		
		this.setupDataPolling = function(seconds) {
			window.setInterval(function() {
				console.log('polling for new data');
				updateData();
			}, 1000 * (seconds || 60));
		};
		
		this.updateData = function() {
			var scheduler = this;
			$.getJSON('update.json.php', function(data) {
				var start = new Date().getTime();
				(data.tickets || []).map(function(newData) {
					var currentTicket = ko.utils.arrayFirst(scheduler.tickets(), function(ticket) {
						return ticket.id == newData.uid;
					});
					currentTicket.populate(newData);
				});
				(data.users || []).map(function(user) {
					var userObj = ko.utils.arrayFirst(scheduler.users(), function(curUser) {
						return curUser.id == user.id;
					});
					(user.tasks || []).map(function(newData) {
						var currentTask = ko.utils.arrayFirst(userObj.tasks(), function(task) {
							return task.id() == newData.uid;
						});
						newData.user = userObj;
						currentTask.populate(newData);
					});
				});
			});
		};
		
		this.authenticate = function(done, fail) {
			$.ajax({
				type: 'get',
				url: '/api/auth/check'
			}).done(function() {
				if (done)
					done();
			}).fail(function(jqXHR, textStatus, errorThrown) {
				if (fail)
					fail(jqXHR, textStatus, errorThrown);
			});
		};

		this.loadViews = function(files, appendTo, callback) {
			var counter = 0;
			var total = files.length;
			files.forEach(function(file) {
				$.get(file, function(response) {
					appendTo.append(response);
					counter++;
					if (counter == total)
						callback();
				});
			});
		};
	}

	function LoginScreen() {

	}
