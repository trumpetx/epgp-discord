$(function() {
  $('[data-toggle="tooltip"]').tooltip();
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
  $('#currentRoster').DataTable({
    pageLength: 25,
    order: [[4, 'desc']]
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

  const validateInput = ($uploadBackup, condition, errorMessage) => {
    if (condition) {
      $alert = $(
        `<div class="alert alert-danger alert-dismissible alert-dismissible fade show center" role="alert">
          ${errorMessage}
          <br/><br/>
          <img src="/import.png"/>
          <br/>
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>`
      );
      $uploadBackup.val('');
      $('#uploadModal').modal('hide');
      $('.alert').remove();
      $('.header').after($alert);
    }
    return !condition;
  };
  $('#uploadBackupForm').on('submit', _evt => {
    const $uploadBackup = $(this).find('#uploadBackup');
    return (
      validateInput(
        $uploadBackup,
        !!$uploadBackup.val().match(/^\s*#/),
        'Unable to process the "Detailed Export" in .tsv format.  Please use the basic Export option.'
      ) && validateInput($uploadBackup, !$uploadBackup.val().match(/^\s*\{.*\}\s*$/), 'Please paste the JSON "Export" from "Log"')
    );
  });
  const onAdvancedChange = () => {
    const checked = $('#advancedModeCheckbox').prop('checked');
    ['#characterClass', '#characterAlias', '#characterName', '#characterNote'].forEach(el => $(el).prop('disabled', checked));
    $('#advancedImport').prop('disabled', !checked);
    $('.simpleModeGroup').toggle(!checked);
    $('.advancedModeGroup').toggle(checked);
  };
  $('#advancedModeCheckbox').change(onAdvancedChange);
  onAdvancedChange();
});
