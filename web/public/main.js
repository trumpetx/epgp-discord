$(function() {
  $('[data-toggle="tooltip"]').tooltip();
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
  $('#currentRoster').DataTable({
    pageLength: 25,
    order: [[3, 'desc']]
  });
  $('#exampleTable').DataTable({
    paging: false,
    searching: false,
    bInfo: false,
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
  $('#loot').DataTable({
    paging: false,
    searching: false,
    bInfo: false,
    order: [[2, 'desc']]
  });
  $('.confirm').on('click', _evt => confirm('Are you sure?'));
});
