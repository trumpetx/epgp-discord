$(function() {
  $('[data-toggle="tooltip"]').tooltip();
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
  $('#currentRoster').DataTable({
    pageLength: 25,
    order: [[3, 'desc']]
  });
  $('#backups').DataTable({
    pageLength: 3,
    ordering: false,
    lengthMenu: [
      [3, 10, 25, 50, -1],
      [3, 10, 25, 50, 'All']
    ]
  });
  $('.confirm').on('click', _evt => confirm('Are you sure?'));
});
